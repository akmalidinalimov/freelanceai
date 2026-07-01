import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { SPECIALIZATIONS, specLabel } from "@/lib/specializations";
import { computeSpecEvidence } from "@/lib/niche-evidence";

/**
 * S1 creator matching — "describe your job → best-matched creators".
 *
 * v1 is lexical (trigram over gigs, already indexed) + declared-specialization match,
 * ranked by relevance + proof (completed orders) + quality (rating/level). It queries
 * live tables (always fresh, no materialized doc to backfill). Semantic recall
 * (pgvector) and Claude intent parsing layer on later without changing this contract.
 */

export interface Intent {
  terms: string[]; // expanded lexical terms (query tokens + taxonomy synonyms)
  specKeys: string[]; // detected specialization keys (skills + niches)
  specLabels: string[]; // localized labels for the detected keys
}

export interface MatchResult {
  sellerId: string;
  username: string | null;
  name: string;
  avatar: string | null;
  verified: boolean;
  level: string;
  ratingAvg: number;
  ratingCount: number;
  completedOrders: number;
  matchedSpecs: string[]; // localized labels of the creator's specs that matched the query
  score: number; // 0..100 display
  components: { relevance: number; proof: number; quality: number }; // 0..1 each (debug/eval)
}

const LEVEL_RANK: Record<string, number> = { NEW: 0, LEVEL_1: 1, LEVEL_2: 2, TOP_RATED: 3 };

/** Lowercase + strip Uzbek apostrophe variants (oʻyin/o'yin → oyin) so queries match the
 * apostrophe-less taxonomy synonyms, and Cyrillic/Latin both normalize consistently. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/['`ʻʼ‘’]/g, "");
}

/**
 * Parse a free-text brief into detected specializations + expanded lexical terms.
 * Matching is TOKEN-based, not substring: a single-word synonym must appear as a whole
 * query token (so "it" no longer fires on "ed**it**ing", "art" no longer fires on
 * "st**art**ap"); multi-word synonyms match as a phrase within the normalized query.
 */
export function parseIntent(query: string, locale = "uz"): Intent {
  const normQ = normalize(query);
  const tokens = normQ.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const matchTokens = new Set(tokens.filter((w) => w.length >= 2)); // whole-word synonym match
  const terms = new Set<string>(tokens.filter((w) => w.length >= 3)); // lexical/tag expansion
  const specKeys: string[] = [];
  const specLabels: string[] = [];
  for (const s of SPECIALIZATIONS) {
    const names = [s.uz, s.ru, s.en, ...s.synonyms].map(normalize).filter(Boolean);
    const hit = names.some((w) =>
      /[\s-]/.test(w) ? normQ.includes(w) : matchTokens.has(w)
    );
    if (hit) {
      specKeys.push(s.key);
      specLabels.push(specLabel(s.key, locale));
      s.synonyms.forEach((w) => terms.add(normalize(w)));
    }
  }
  return { terms: [...terms], specKeys, specLabels };
}

/** Match creators to a natural-language query. Returns detected intent + ranked results. */
export async function matchCreators(
  query: string,
  opts: { limit?: number; locale?: string } = {}
): Promise<{ intent: Intent; results: MatchResult[] }> {
  const locale = opts.locale ?? "uz";
  const limit = opts.limit ?? 10;
  const intent = parseIntent(query, locale);

  // relevance per seller: 0..1
  const rel = new Map<string, number>();

  // 1) trigram / ILIKE over gig text (Gig already has pg_trgm indexes)
  const like = `%${query.trim()}%`;
  try {
    const rows = await prisma.$queryRaw<{ sellerId: string; rel: number }[]>(Prisma.sql`
      SELECT g."sellerId" AS "sellerId",
             MAX(GREATEST(word_similarity(${query}, g.title), word_similarity(${query}, g.description)))::float AS rel
      FROM "Gig" g
      WHERE g.status = 'ACTIVE' AND g."deletedAt" IS NULL
        AND ( word_similarity(${query}, g.title) >= 0.2
           OR word_similarity(${query}, g.description) >= 0.2
           OR g.title ILIKE ${like}
           OR g.description ILIKE ${like} )
      GROUP BY g."sellerId"
      LIMIT 100`);
    for (const r of rows) rel.set(r.sellerId, Math.max(rel.get(r.sellerId) ?? 0, Math.min(1, r.rel)));
  } catch {
    // trigram unavailable → fall back to a plain contains query
    const gigs = await prisma.gig.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { sellerId: true },
      take: 100,
    });
    for (const g of gigs) rel.set(g.sellerId, Math.max(rel.get(g.sellerId) ?? 0, 0.45));
  }

  // 2) tag matches (expanded terms) → moderate relevance
  if (intent.terms.length) {
    const tagGigs = await prisma.gig.findMany({
      where: { status: "ACTIVE", deletedAt: null, tags: { hasSome: intent.terms } },
      select: { sellerId: true },
      take: 200,
    });
    for (const g of tagGigs) rel.set(g.sellerId, Math.max(rel.get(g.sellerId) ?? 0, 0.4));
  }

  // 3) declared-specialization matches → creators who listed the detected skill/niche
  const declaredBySeller = new Map<string, string[]>();
  if (intent.specKeys.length) {
    const profs = await prisma.sellerProfile.findMany({
      where: { specializations: { hasSome: intent.specKeys } },
      select: { userId: true, specializations: true },
      take: 200,
    });
    for (const p of profs) {
      declaredBySeller.set(p.userId, p.specializations);
      rel.set(p.userId, Math.max(rel.get(p.userId) ?? 0, 0.35));
    }
  }

  const ids = [...rel.keys()];
  if (ids.length === 0) return { intent, results: [] };

  // fetch active seller identities + profiles
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, isSeller: true, status: "ACTIVE" },
    select: {
      id: true,
      firstName: true,
      name: true,
      username: true,
      image: true,
      photoUrl: true,
      kycStatus: true,
      sellerProfile: {
        select: { specializations: true, ratingAvg: true, ratingCount: true, level: true },
      },
    },
  });

  // proof: completed orders per seller
  const completedRows = await prisma.order.groupBy({
    by: ["sellerId"],
    where: { sellerId: { in: users.map((u) => u.id) }, status: "COMPLETED" },
    _count: true,
  });
  const completedBy = new Map(completedRows.map((r) => [r.sellerId, r._count]));

  // niche evidence: active gig tags/category + completed-order categories per candidate
  const uids = users.map((u) => u.id);
  const [gigRows, orderCatRows] = await Promise.all([
    prisma.gig.findMany({
      where: { sellerId: { in: uids }, status: "ACTIVE", deletedAt: null },
      select: { sellerId: true, tags: true, category: { select: { slug: true } } },
      take: 400,
    }),
    prisma.order.findMany({
      where: { sellerId: { in: uids }, status: "COMPLETED" },
      select: { sellerId: true, gig: { select: { category: { select: { slug: true } } } } },
      take: 400,
    }),
  ]);
  const gigTagsBy = new Map<string, string[]>();
  const gigCatBy = new Map<string, string[]>();
  for (const g of gigRows) {
    if (g.tags.length) gigTagsBy.set(g.sellerId, [...(gigTagsBy.get(g.sellerId) ?? []), ...g.tags]);
    if (g.category?.slug) gigCatBy.set(g.sellerId, [...(gigCatBy.get(g.sellerId) ?? []), g.category.slug]);
  }
  const orderCatBy = new Map<string, string[]>();
  for (const o of orderCatRows) {
    const slug = o.gig.category?.slug;
    if (slug) orderCatBy.set(o.sellerId, [...(orderCatBy.get(o.sellerId) ?? []), slug]);
  }

  const results: MatchResult[] = users.map((u) => {
    const p = u.sellerProfile;
    const specs = p?.specializations ?? declaredBySeller.get(u.id) ?? [];
    const evidence = computeSpecEvidence({
      declared: specs,
      gigTags: gigTagsBy.get(u.id) ?? [],
      gigCategorySlugs: gigCatBy.get(u.id) ?? [],
      orderCategorySlugs: orderCatBy.get(u.id) ?? [],
    });
    // Ranking tiers (anti-gaming): proven (delivered work) > supported (has gigs, no
    // orders) > declared-only. A tagged-but-never-delivered niche cannot top a proven one.
    const provenKeys = intent.specKeys.filter((k) => evidence.get(k)?.proven);
    const supportedKeys = intent.specKeys.filter((k) => evidence.get(k)?.supported);
    const declaredOnlyKeys = intent.specKeys.filter((k) => {
      const e = evidence.get(k);
      return e?.declared && !e.proven && !e.supported;
    });
    const matchedKeys = [...provenKeys, ...supportedKeys, ...declaredOnlyKeys];
    const completed = completedBy.get(u.id) ?? 0;
    // Cap above 1 so matching MULTIPLE proven niches (e.g. fashion + video) outranks a
    // single-niche match even before proof/quality separate brand-new creators.
    const relevance = Math.min(
      1.5,
      (rel.get(u.id) ?? 0) +
        provenKeys.length * 0.5 +
        supportedKeys.length * 0.25 +
        declaredOnlyKeys.length * 0.15
    );
    const proof = Math.min(1, Math.log10(1 + completed) / 2); // ~100 orders → 1
    const quality =
      ((p?.ratingAvg ?? 0) / 5) * 0.7 +
      Math.min(1, (p?.ratingCount ?? 0) / 30) * 0.15 +
      (LEVEL_RANK[p?.level ?? "NEW"] / 3) * 0.15;
    const raw = 0.5 * relevance + 0.25 * proof + 0.25 * quality;
    // Display score compresses the top band so several strong matches don't all render
    // "100%" and lose their ordering; raw components stay exact for eval/debug.
    const display = raw >= 1 ? 0.9 + (Math.min(raw, 1.25) - 1) * 0.28 : raw * 0.9;
    return {
      sellerId: u.id,
      username: u.username,
      name: u.firstName ?? u.name ?? u.username ?? "",
      avatar: u.image ?? u.photoUrl ?? null,
      verified: u.kycStatus === "VERIFIED",
      level: p?.level ?? "NEW",
      ratingAvg: p?.ratingAvg ?? 0,
      ratingCount: p?.ratingCount ?? 0,
      completedOrders: completed,
      matchedSpecs: matchedKeys.map((k) => specLabel(k, locale)),
      score: Math.round(Math.max(0.05, Math.min(0.99, display)) * 100),
      components: {
        relevance: Math.round(relevance * 100) / 100,
        proof: Math.round(proof * 100) / 100,
        quality: Math.round(quality * 100) / 100,
      },
    };
  });

  results.sort((a, b) => b.score - a.score);
  return { intent, results: results.slice(0, limit) };
}
