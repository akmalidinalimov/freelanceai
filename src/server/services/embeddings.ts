import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { specLabel } from "@/lib/specializations";

/**
 * S2 — semantic search embeddings (docs/search-ai-spec.md §3-4). One 1024-dim Voyage
 * embedding per seller over their "creator document" (headline + bio + specializations
 * + gig text, all three languages of labels). Rebuilt nightly by the cron (cheap at
 * current scale) and used at query time via pgvector kNN. Fail-open everywhere: no
 * key / API error → lexical-only search, never a user-facing failure.
 */

const MODEL = "voyage-3.5-lite";
const DIM = 1024;
const TIMEOUT_MS = 4000;

function configured(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

async function voyageEmbed(
  inputs: string[],
  inputType: "document" | "query"
): Promise<number[][] | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey || inputs.length === 0) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        input: inputs.map((t) => t.slice(0, 8000)),
        input_type: inputType,
        output_dimension: DIM,
      }),
    });
    if (!res.ok) {
      console.error("embeddings: voyage status", res.status);
      return null;
    }
    const data = (await res.json()) as { data?: Array<{ index: number; embedding: number[] }> };
    if (!data.data || data.data.length !== inputs.length) return null;
    // Voyage returns entries with an index field; order by it defensively.
    const out: number[][] = new Array(inputs.length);
    for (const d of data.data) out[d.index] = d.embedding;
    return out.every((e) => Array.isArray(e) && e.length === DIM) ? out : null;
  } catch (err) {
    if ((err as Error).name !== "AbortError") console.error("embeddings failed", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Query-time embed. Small in-memory cache — repeat queries are common. */
const queryCache = new Map<string, { at: number; vec: number[] | null }>();
const QUERY_CACHE_MAX = 300;
const QUERY_CACHE_TTL_MS = 60 * 60 * 1000;

export async function embedQuery(query: string): Promise<number[] | null> {
  if (!configured()) return null;
  const key = query.toLowerCase().replace(/\s+/g, " ").trim();
  const hit = queryCache.get(key);
  // Null (failed) embeds get a short TTL — a Voyage blip must not pin a popular
  // query to lexical-only for a whole hour.
  if (hit && Date.now() - hit.at < (hit.vec === null ? 60_000 : QUERY_CACHE_TTL_MS)) {
    return hit.vec;
  }
  const vecs = await voyageEmbed([key], "query");
  const vec = vecs?.[0] ?? null;
  if (queryCache.size >= QUERY_CACHE_MAX) {
    const oldest = queryCache.keys().next().value;
    if (oldest !== undefined) queryCache.delete(oldest);
  }
  queryCache.set(key, { at: Date.now(), vec });
  return vec;
}

/** The creator document: everything that describes what this seller makes. */
function buildDoc(seller: {
  firstName: string | null;
  username: string | null;
  sellerProfile: { headline: string | null; bio: string | null; specializations: string[] } | null;
  gigs: Array<{ title: string; description: string; tags: string[] }>;
}): string {
  const specs = (seller.sellerProfile?.specializations ?? [])
    .flatMap((k) => [specLabel(k, "uz"), specLabel(k, "ru"), specLabel(k, "en")]);
  const parts = [
    seller.sellerProfile?.headline,
    seller.sellerProfile?.bio,
    specs.join(", "),
    ...seller.gigs.flatMap((g) => [g.title, g.description.slice(0, 500), g.tags.join(" ")]),
  ];
  return parts.filter(Boolean).join("\n").slice(0, 8000);
}

/**
 * Rebuild embeddings for ALL active sellers. Runs from the nightly cron; the initial
 * backfill is a manual cron fire after the S2 deploy (workflow_dispatch on red-flags).
 * Skips sellers whose doc text is unchanged (no wasted Voyage calls). Batches of 32.
 * Ends by removing rows for sellers no longer active (banned/deactivated) so stale
 * vectors don't occupy kNN slots.
 */
export async function rebuildSellerEmbeddings(): Promise<{ sellers: number; embedded: number }> {
  if (!configured()) return { sellers: 0, embedded: 0 };
  const sellers = await prisma.user.findMany({
    // Only APPROVED sellers are publicly searchable — don't embed (or keep vectors for)
    // unapproved/rejected sellers; the semantic arm must never surface them.
    where: { isSeller: true, status: "ACTIVE", sellerProfile: { is: { approvalStatus: "APPROVED" } } },
    select: {
      id: true,
      firstName: true,
      username: true,
      sellerProfile: { select: { headline: true, bio: true, specializations: true } },
      gigs: {
        where: { status: "ACTIVE", deletedAt: null },
        select: { title: true, description: true, tags: true },
        // Deterministic order — buildDoc output feeds the unchanged-doc skip; an
        // unstable order would cache-bust every seller every night (full re-embed).
        orderBy: { createdAt: "asc" },
        take: 20,
      },
    },
  });

  const existing = await prisma.sellerEmbedding.findMany({ select: { sellerId: true, docText: true } });
  const docByExisting = new Map(existing.map((e) => [e.sellerId, e.docText]));

  const stale = sellers
    .map((s) => ({ id: s.id, doc: buildDoc(s) }))
    .filter((s) => s.doc.length >= 20 && docByExisting.get(s.id) !== s.doc);

  let embedded = 0;
  for (let i = 0; i < stale.length; i += 32) {
    const batch = stale.slice(i, i + 32);
    const vecs = await voyageEmbed(batch.map((b) => b.doc), "document");
    if (!vecs) break; // upstream trouble — stop, retry next run
    for (let j = 0; j < batch.length; j++) {
      const vecLiteral = `[${vecs[j].join(",")}]`;
      // Raw upsert: Prisma can't write Unsupported("vector") columns.
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "SellerEmbedding" ("sellerId", "docText", "embedding", "updatedAt")
        VALUES (${batch[j].id}, ${batch[j].doc}, ${vecLiteral}::vector, NOW())
        ON CONFLICT ("sellerId")
        DO UPDATE SET "docText" = EXCLUDED."docText", "embedding" = EXCLUDED."embedding", "updatedAt" = NOW()
      `);
      embedded += 1;
    }
  }

  await prisma.sellerEmbedding
    .deleteMany({ where: { sellerId: { notIn: sellers.map((s) => s.id) } } })
    .catch(() => {});

  return { sellers: sellers.length, embedded };
}

/** kNN: top sellers by cosine similarity to the query vector. Returns sellerId → 0..1.
 * A similarity floor keeps gibberish queries returning "no results" instead of a
 * confidently-ranked list of the least-unrelated sellers. */
const SIM_FLOOR = 0.35;

export async function semanticCandidates(queryVec: number[], limit = 50): Promise<Map<string, number>> {
  const vecLiteral = `[${queryVec.join(",")}]`;
  const rows = await prisma.$queryRaw<Array<{ sellerId: string; sim: number }>>(Prisma.sql`
    SELECT "sellerId", (1 - ("embedding" <=> ${vecLiteral}::vector))::float AS sim
    FROM "SellerEmbedding"
    WHERE "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${vecLiteral}::vector
    LIMIT ${limit}
  `);
  return new Map(
    rows.filter((r) => r.sim >= SIM_FLOOR).map((r) => [r.sellerId, Math.max(0, Math.min(1, r.sim))])
  );
}
