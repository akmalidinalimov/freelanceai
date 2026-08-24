import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { requireSeller } from "@/lib/authz";
import { enforceRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { generateGigCover } from "@/server/services/cover-template";
import type { Locale } from "@/i18n/routing";

const schema = z
  .object({
    title: z.string().trim().min(3).max(120),
    categoryId: z.string().max(64).optional(),
    priceUzs: z.number().int().positive().max(1_000_000_000).optional(),
    locale: z.enum(["uz", "ru", "en"]).default("uz"),
  })
  .strict();

/**
 * Generate a branded 16:9 cover for a gig that has none. Deterministic template render
 * (no AI, no external API), stored once in R2 — so a seller is never blocked at the
 * cover step and no gig ships with the generic placeholder.
 */
export const POST = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();
  requireSeller(user);
  // Rendering is cheap but not free; bound it per seller so a stuck client can't spin.
  enforceRateLimit(`cover-gen:${user.id}`, 20, 60_000);

  let categoryLabel: string | undefined;
  let categorySlug: string | undefined;
  if (body.categoryId) {
    const cat = await prisma.category
      .findUnique({
        where: { id: body.categoryId },
        select: { slug: true, nameUz: true, nameRu: true, nameEn: true },
      })
      .catch(() => null);
    if (cat) {
      categorySlug = cat.slug;
      categoryLabel = cat[({ uz: "nameUz", ru: "nameRu", en: "nameEn" } as const)[body.locale as Locale]];
    }
  }

  const { url, bytes } = await generateGigCover({
    title: body.title,
    categoryLabel,
    categorySlug,
    sellerName: user.firstName ?? user.name ?? undefined,
    username: user.username,
    priceUzs: body.priceUzs,
  });
  return ok({ url, bytes });
});
