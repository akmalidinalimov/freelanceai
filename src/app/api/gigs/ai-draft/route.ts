import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { requireSeller } from "@/lib/authz";
import { enforceRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { generateGigDraft, templateGigDraft } from "@/server/services/gig-ai";

const schema = z
  .object({
    service: z.string().trim().min(2).max(500),
    // Optional since the one-field wizard: the brief in `service` covers both.
    deliverable: z.string().trim().min(2).max(500).optional(),
    days: z.number().int().min(1).max(365),
    // Optional: when the seller skips pricing, we anchor on the category's market median.
    priceUzs: z.number().int().min(1000).max(1_000_000_000).optional(),
    categoryId: z.string().max(64).optional(),
    differentiator: z.string().trim().max(300).optional(),
    locale: z.enum(["uz", "ru", "en"]).default("uz"),
  })
  .strict();

/** Fallback starting price when a category has no market data yet (≈ a typical small gig). */
const DEFAULT_BASE_PRICE_UZS = 50_000;

/**
 * Market anchor for sellers who skip the price question: the median BASIC price of live
 * gigs (in their category when possible). Never throws — pricing must not block drafting.
 */
async function suggestBasePriceUzs(categoryId?: string): Promise<number> {
  try {
    const where = (catId?: string) => ({
      tier: "BASIC" as const,
      gig: { status: "ACTIVE" as const, deletedAt: null, ...(catId ? { categoryId: catId } : {}) },
    });
    let prices = categoryId
      ? await prisma.gigPackage.findMany({ where: where(categoryId), select: { priceUzs: true }, take: 200 })
      : [];
    if (prices.length < 3) {
      prices = await prisma.gigPackage.findMany({ where: where(), select: { priceUzs: true }, take: 200 });
    }
    if (prices.length === 0) return DEFAULT_BASE_PRICE_UZS;
    const sorted = prices.map((p) => p.priceUzs).sort((a, b) => a - b);
    return Math.max(1000, sorted[Math.floor(sorted.length / 2)]);
  } catch {
    return DEFAULT_BASE_PRICE_UZS;
  }
}

interface Cat {
  id: string;
  slug: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
}

/**
 * No-AI category guess: score each category by how many of its name/slug tokens
 * (≥4 chars) appear in the brief. Used to anchor the price median before the AI
 * call, and as the classification fallback when the model is unavailable.
 */
function keywordCategory(brief: string, cats: Cat[]): Cat | null {
  const b = brief.toLowerCase();
  let best: Cat | null = null;
  let bestScore = 0;
  for (const c of cats) {
    const tokens = [c.slug, c.nameUz, c.nameRu, c.nameEn]
      .flatMap((n) => n.toLowerCase().split(/[^\p{L}\p{N}]+/u))
      .filter((t) => t.length >= 4);
    const score = new Set(tokens.filter((t) => b.includes(t))).size;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/** Generate a structured gig draft from a few answers. Seller-only; never publishes. */
export const POST = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();
  requireSeller(user);
  enforceRateLimit(`gig-ai:${user.id}`, 10, 60_000);

  const cats: Cat[] = await prisma.category
    .findMany({ select: { id: true, slug: true, nameUz: true, nameRu: true, nameEn: true } })
    .catch(() => []);
  const kwCat = keywordCategory(body.service, cats);

  // Price anchor: explicit seller category > keyword-guessed category > global median.
  const priceUzs = body.priceUzs ?? (await suggestBasePriceUzs(body.categoryId ?? kwCat?.id));
  const input = {
    service: body.service,
    // The one-field brief doubles as the deliverable when none was given separately.
    deliverable: body.deliverable ?? body.service,
    days: body.days,
    priceUzs,
    ...(body.differentiator ? { differentiator: body.differentiator } : {}),
  };
  const locale = body.locale ?? "uz";
  const label = ({ uz: "nameUz", ru: "nameRu", en: "nameEn" } as const)[locale];
  // Fail-open: if Claude is unavailable/over-budget, return the deterministic template draft so
  // the seller still gets a filled-in form instead of an error.
  const draft =
    (await generateGigDraft(input, locale, cats.map((c) => ({ slug: c.slug, label: c[label] })))) ??
    templateGigDraft(input);

  // Category: the seller's explicit pick wins; else the model's validated slug; else keywords.
  const categoryId =
    body.categoryId ??
    (draft.categorySlug ? (cats.find((c) => c.slug === draft.categorySlug)?.id ?? null) : null) ??
    kwCat?.id ??
    null;

  return ok({ draft, categoryId, aiUsed: draft !== null });
});
