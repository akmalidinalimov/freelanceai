import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { SPECIALIZATIONS, specLabel, specBySlug } from "@/lib/specializations";
import { computeSpecEvidence } from "@/lib/niche-evidence";
import { parseIntentWithClaude } from "@/server/services/intent-ai";
import { embedQuery, semanticCandidates } from "@/server/services/embeddings";

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
): Promise<{ intent: Intent & { understood?: string; ai?: boolean }; results: MatchResult[] }> {
  const locale = opts.locale ?? "uz";
  const limit = opts.limit ?? 10;

  // S3: Claude parse (fuzzy, cross-language) UNIONED with the deterministic lexical
  // parse — the lexical arm stays the precision floor; AI only ever ADDS recall.
  // S2: the query embedding runs CONCURRENTLY with the parse (independent calls).
  // Both are fail-open (null on no-key/timeout) → pure S1 behavior.
  const lexical = parseIntent(query, locale);
  const [ai, queryVec] = await Promise.all([
    parseIntentWithClaude(query, locale),
    embedQuery(query).catch(() => null),
  ]);
  const specKeys = [...new Set([...lexical.specKeys, ...(ai?.specKeys ?? [])])];
  const intent: Intent & { understood?: string; ai?: boolean } = {
    terms: [...new Set([...lexical.terms, ...(ai?.terms ?? [])])],
    specKeys,
    specLabels: specKeys.map((k) => specLabel(k, locale)),
    understood: ai?.understood,
    ai: Boolean(ai),
  };

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

  // 4) S2 semantic arm: pgvector kNN over creator-document embeddings, fused with the
  // lexical relevance by Reciprocal Rank Fusion (RANKS, not raw scores — ts_rank and
  // cosine live on different scales; spec §4). Absent embeddings → lexical-only.
  if (queryVec) {
    try {
      const semantic = await semanticCandidates(queryVec, 50);
      if (semantic.size > 0) {
        const K = 60;
        const rrf = new Map<string, number>();
        [...rel.entries()]
          .sort((a, b) => b[1] - a[1])
          .forEach(([id], i) => rrf.set(id, (rrf.get(id) ?? 0) + 1 / (K + i + 1)));
        [...semantic.entries()]
          .sort((a, b) => b[1] - a[1])
          .forEach(([id], i) => rrf.set(id, (rrf.get(id) ?? 0) + 1 / (K + i + 1)));
        const max = Math.max(...rrf.values());
        rel.clear();
        for (const [id, v] of rrf) rel.set(id, v / max);
      }
    } catch (err) {
      // vector extension/table missing (pre-migration) — lexical-only, never fatal.
      console.error("semantic arm skipped", err);
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
      orderBy: { createdAt: "desc" }, // deterministic which rows the 400-cap keeps
      take: 400,
    }),
    prisma.order.findMany({
      where: { sellerId: { in: uids }, status: "COMPLETED" },
      select: { sellerId: true, gig: { select: { category: { select: { slug: true } } } } },
      orderBy: { createdAt: "desc" },
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

// ── Gig-first matching ────────────────────────────────────────────────────────
// Fiverr-style: a search / category tap returns GIGS, not creators. Each gig is
// ranked by (gig relevance) × (seller's niche evidence for that gig's category) ×
// (gig/seller quality), with the seller's trust embedded on the card. Price is NOT
// exposed — we show a budget TIER (₮/₮₮/₮₮₮) so browsing stays about fit, and the
// buyer discovers exact pricing inside the gig. Reuses parseIntent + the semantic
// arm + computeSpecEvidence; matchCreators stays untouched (secondary "Creators" tab).

/** Budget tier from a gig's "from" price (min package). Tuned for the UZ AI-creative
 * market: ₮ entry, ₮₮ standard, ₮₮₮ premium. Thresholds are display-only, never shown. */
const BUDGET_T2_UZS = 1_500_000;
const BUDGET_T3_UZS = 3_500_000;
export function budgetTierFor(fromUzs: number): 1 | 2 | 3 {
  return fromUzs >= BUDGET_T3_UZS ? 3 : fromUzs >= BUDGET_T2_UZS ? 2 : 1;
}

export interface GigMatch {
  gigId: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  categorySlug: string | null;
  seller: {
    sellerId: string;
    username: string | null;
    name: string;
    avatar: string | null;
    verified: boolean;
    level: string;
    ratingAvg: number;
    ratingCount: number;
    completedOrders: number;
  };
  whyMatched: string[]; // localized spec labels this gig matched (may be empty for pure-lexical)
  proof: { tier: "proven" | "supported" | "declared"; label: string; orders: number } | null;
  band: "strong" | "good" | "broad"; // match confidence banner on the card
  budgetTier: 1 | 2 | 3;
  fromDeliveryDays: number; // delivery of the entry (min-price) package
  score: number; // 0..100 display
}

/** Derive the spec keys a gig belongs to, from its category slug + tags (mirrors how
 * niche-evidence attributes gigs to specs). Used to intersect with the query intent. */
export function gigSpecKeys(categorySlug: string | null, tags: string[]): Set<string> {
  const keys = new Set<string>();
  if (categorySlug) {
    const s = specBySlug(categorySlug);
    if (s) keys.add(s.key);
  }
  if (tags.length) {
    const norm = tags.map(normalize);
    for (const s of SPECIALIZATIONS) {
      const syn = [s.uz, s.ru, s.en, ...s.synonyms].map(normalize);
      if (norm.some((t) => syn.includes(t) || t === s.key)) keys.add(s.key);
    }
  }
  return keys;
}

/** Match GIGS to a natural-language query (gig-first discovery). Returns detected intent
 * + ranked gigs, each carrying the seller's embedded trust + why-matched + niche proof. */
export async function matchGigs(
  query: string,
  opts: { limit?: number; locale?: string; perSeller?: number } = {}
): Promise<{ intent: Intent & { understood?: string; ai?: boolean }; results: GigMatch[] }> {
  const locale = opts.locale ?? "uz";
  const limit = opts.limit ?? 24;
  const perSeller = opts.perSeller ?? 2;

  // Same intent stack as matchCreators: deterministic lexical parse (precision floor)
  // UNIONED with Claude parse (recall), plus a concurrent query embedding (fail-open).
  const lexical = parseIntent(query, locale);
  const [ai, queryVec] = await Promise.all([
    parseIntentWithClaude(query, locale),
    embedQuery(query).catch(() => null),
  ]);
  const specKeys = [...new Set([...lexical.specKeys, ...(ai?.specKeys ?? [])])];
  const intent: Intent & { understood?: string; ai?: boolean } = {
    terms: [...new Set([...lexical.terms, ...(ai?.terms ?? [])])],
    specKeys,
    specLabels: specKeys.map((k) => specLabel(k, locale)),
    understood: ai?.understood,
    ai: Boolean(ai),
  };
  const matchedSlugs = specKeys.map((k) => k.replace(/_/g, "-"));

  // gig-grain relevance: 0..1
  const gigRel = new Map<string, number>();

  // 1) trigram / ILIKE over gig text (gig-grain, so a strong gig surfaces even if the
  //    seller has weaker gigs elsewhere)
  const like = `%${query.trim()}%`;
  try {
    const rows = await prisma.$queryRaw<{ gigId: string; rel: number }[]>(Prisma.sql`
      SELECT g.id AS "gigId",
             GREATEST(word_similarity(${query}, g.title), word_similarity(${query}, g.description))::float AS rel
      FROM "Gig" g
      WHERE g.status = 'ACTIVE' AND g."deletedAt" IS NULL
        AND ( word_similarity(${query}, g.title) >= 0.2
           OR word_similarity(${query}, g.description) >= 0.2
           OR g.title ILIKE ${like}
           OR g.description ILIKE ${like} )
      ORDER BY rel DESC
      LIMIT 120`);
    for (const r of rows) gigRel.set(r.gigId, Math.max(gigRel.get(r.gigId) ?? 0, Math.min(1, r.rel)));
  } catch {
    const gigs = await prisma.gig.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { id: true },
      take: 120,
    });
    for (const g of gigs) gigRel.set(g.id, Math.max(gigRel.get(g.id) ?? 0, 0.45));
  }

  // 2) tag matches (expanded terms) → moderate relevance
  if (intent.terms.length) {
    const tagGigs = await prisma.gig.findMany({
      where: { status: "ACTIVE", deletedAt: null, tags: { hasSome: intent.terms } },
      select: { id: true },
      take: 150,
    });
    for (const g of tagGigs) gigRel.set(g.id, Math.max(gigRel.get(g.id) ?? 0, 0.4));
  }

  // 3) category-in-detected-spec → gigs in a matched skill/niche category (recovers
  //    relevant gigs whose text didn't lexically hit the raw query)
  if (matchedSlugs.length) {
    const catGigs = await prisma.gig.findMany({
      where: { status: "ACTIVE", deletedAt: null, category: { slug: { in: matchedSlugs } } },
      select: { id: true },
      take: 150,
    });
    for (const g of catGigs) gigRel.set(g.id, Math.max(gigRel.get(g.id) ?? 0, 0.38));
  }

  // 4) S2 semantic arm: pgvector kNN over creator-doc embeddings → a set of semantically
  //    relevant sellers. We (a) pull their spec-matched gigs in for recall, and (b) boost
  //    already-candidate gigs whose seller landed in the set. (Gig-level embeddings are a
  //    later upgrade; seller-level recall is the honest v1.)
  let semanticSellers = new Set<string>();
  if (queryVec) {
    try {
      const semantic = await semanticCandidates(queryVec, 40);
      semanticSellers = new Set(semantic.keys());
      if (semanticSellers.size > 0 && matchedSlugs.length) {
        const semGigs = await prisma.gig.findMany({
          where: {
            sellerId: { in: [...semanticSellers] },
            status: "ACTIVE",
            deletedAt: null,
            category: { slug: { in: matchedSlugs } },
          },
          select: { id: true },
          take: 100,
        });
        for (const g of semGigs) gigRel.set(g.id, Math.max(gigRel.get(g.id) ?? 0, 0.4));
      }
    } catch (err) {
      console.error("gig semantic arm skipped", err);
    }
  }

  const gigIds = [...gigRel.keys()];
  if (gigIds.length === 0) return { intent, results: [] };

  // fetch full candidate gigs with seller identity/profile + packages
  const gigs = await prisma.gig.findMany({
    where: { id: { in: gigIds }, status: "ACTIVE", deletedAt: null },
    select: {
      id: true,
      slug: true,
      title: true,
      coverUrl: true,
      tags: true,
      featured: true,
      sellerId: true,
      category: { select: { slug: true } },
      packages: { select: { priceUzs: true, deliveryDays: true } },
      seller: {
        select: {
          id: true,
          firstName: true,
          name: true,
          username: true,
          image: true,
          photoUrl: true,
          kycStatus: true,
          isSeller: true,
          status: true,
          sellerProfile: {
            select: { specializations: true, ratingAvg: true, ratingCount: true, level: true },
          },
        },
      },
    },
  });

  // only sellable gigs from active sellers with at least one package (need a "from" price)
  const usable = gigs.filter(
    (g) => g.seller?.isSeller && g.seller.status === "ACTIVE" && g.packages.length > 0
  );
  if (usable.length === 0) return { intent, results: [] };

  const sellerIds = [...new Set(usable.map((g) => g.sellerId))];

  // proof: completed orders per seller
  const completedRows = await prisma.order.groupBy({
    by: ["sellerId"],
    where: { sellerId: { in: sellerIds }, status: "COMPLETED" },
    _count: true,
  });
  const completedBy = new Map(completedRows.map((r) => [r.sellerId, r._count]));

  // niche evidence signals per seller (active gig tags/category + completed-order categories)
  const [gigRows, orderCatRows] = await Promise.all([
    prisma.gig.findMany({
      where: { sellerId: { in: sellerIds }, status: "ACTIVE", deletedAt: null },
      select: { sellerId: true, tags: true, category: { select: { slug: true } } },
      orderBy: { createdAt: "desc" },
      take: 400,
    }),
    prisma.order.findMany({
      where: { sellerId: { in: sellerIds }, status: "COMPLETED" },
      select: { sellerId: true, gig: { select: { category: { select: { slug: true } } } } },
      orderBy: { createdAt: "desc" },
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

  // evidence computed once per seller, then reused across that seller's candidate gigs
  const evidenceBy = new Map<string, ReturnType<typeof computeSpecEvidence>>();
  for (const sid of sellerIds) {
    const seller = usable.find((g) => g.sellerId === sid)?.seller;
    evidenceBy.set(
      sid,
      computeSpecEvidence({
        declared: seller?.sellerProfile?.specializations ?? [],
        gigTags: gigTagsBy.get(sid) ?? [],
        gigCategorySlugs: gigCatBy.get(sid) ?? [],
        orderCategorySlugs: orderCatBy.get(sid) ?? [],
      })
    );
  }

  const scored: GigMatch[] = usable.map((g) => {
    const p = g.seller!.sellerProfile;
    const evidence = evidenceBy.get(g.sellerId)!;
    const specsOfGig = gigSpecKeys(g.category?.slug ?? null, g.tags);
    // this gig's specs that the query asked for, ordered by the seller's evidence tier
    const provenKeys = specKeys.filter((k) => specsOfGig.has(k) && evidence.get(k)?.proven);
    const supportedKeys = specKeys.filter((k) => specsOfGig.has(k) && evidence.get(k)?.supported);
    const declaredKeys = specKeys.filter((k) => {
      const e = evidence.get(k);
      return specsOfGig.has(k) && e?.declared && !e.proven && !e.supported;
    });
    const matchedKeys = [...provenKeys, ...supportedKeys, ...declaredKeys];

    const completed = completedBy.get(g.sellerId) ?? 0;
    const semanticBoost = semanticSellers.has(g.sellerId) ? 0.12 : 0;
    const relevance = Math.min(
      1.5,
      (gigRel.get(g.id) ?? 0) +
        semanticBoost +
        provenKeys.length * 0.5 +
        supportedKeys.length * 0.25 +
        declaredKeys.length * 0.15
    );
    const proof = Math.min(1, Math.log10(1 + completed) / 2);
    const quality =
      ((p?.ratingAvg ?? 0) / 5) * 0.7 +
      Math.min(1, (p?.ratingCount ?? 0) / 30) * 0.15 +
      (LEVEL_RANK[p?.level ?? "NEW"] / 3) * 0.15;
    // Match % reflects TRUE fit only — featured placement is applied as a sort bonus below,
    // never baked into the displayed score (inflating a "match %" for paid promotion would
    // mislead buyers).
    const raw = 0.5 * relevance + 0.25 * proof + 0.25 * quality;
    const display = raw >= 1 ? 0.9 + (Math.min(raw, 1.25) - 1) * 0.28 : raw * 0.9;
    const score = Math.round(Math.max(0.05, Math.min(0.99, display)) * 100);
    const band: GigMatch["band"] = score >= 82 ? "strong" : score >= 62 ? "good" : "broad";

    // niche proof badge: strongest matched tier for this gig's niche
    let proofBadge: GigMatch["proof"] = null;
    const best = matchedKeys[0];
    if (best) {
      const e = evidence.get(best)!;
      const tier = e.proven ? "proven" : e.supported ? "supported" : "declared";
      proofBadge = { tier, label: specLabel(best, locale), orders: e.fromOrders };
    }

    // "from" package = cheapest tier → budget indicator + its delivery time
    const entry = g.packages.reduce((a, b) => (b.priceUzs < a.priceUzs ? b : a));

    return {
      gigId: g.id,
      slug: g.slug,
      title: g.title,
      coverUrl: g.coverUrl,
      categorySlug: g.category?.slug ?? null,
      seller: {
        sellerId: g.seller!.id,
        username: g.seller!.username,
        name: g.seller!.firstName ?? g.seller!.name ?? g.seller!.username ?? "",
        avatar: g.seller!.image ?? g.seller!.photoUrl ?? null,
        verified: g.seller!.kycStatus === "VERIFIED",
        level: p?.level ?? "NEW",
        ratingAvg: p?.ratingAvg ?? 0,
        ratingCount: p?.ratingCount ?? 0,
        completedOrders: completed,
      },
      whyMatched: matchedKeys.map((k) => specLabel(k, locale)),
      proof: proofBadge,
      band,
      budgetTier: budgetTierFor(entry.priceUzs),
      fromDeliveryDays: entry.deliveryDays,
      score,
    };
  });

  // Featured gigs get a real ordering bump (a paid gig can jump up to ~FEATURED_SORT_BONUS
  // match-points of RANKING) without changing the honest match % on the card. Applied only
  // to sorting, so promoted placement is meaningful but never a total override of fit.
  const FEATURED_SORT_BONUS = 8;
  const featuredBy = new Map(usable.map((g) => [g.id, g.featured]));
  const sortScore = (m: GigMatch) => m.score + (featuredBy.get(m.gigId) ? FEATURED_SORT_BONUS : 0);
  // Deterministic order: (featured-boosted) score desc, then gigId as a stable tiebreak so
  // equal-score gigs (score is a rounded 0..99 int → many ties) don't reorder run-to-run and
  // the per-seller cap keeps the same gigs each call.
  scored.sort((a, b) => sortScore(b) - sortScore(a) || a.gigId.localeCompare(b.gigId));

  // per-seller cap so one prolific seller can't monopolise the grid
  const perSellerCount = new Map<string, number>();
  const results: GigMatch[] = [];
  for (const m of scored) {
    const n = perSellerCount.get(m.seller.sellerId) ?? 0;
    if (n >= perSeller) continue;
    perSellerCount.set(m.seller.sellerId, n + 1);
    results.push(m);
    if (results.length >= limit) break;
  }

  return { intent, results };
}
