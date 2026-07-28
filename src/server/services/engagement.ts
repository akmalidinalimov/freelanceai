import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Engagement engine: trending scores, personalized feed modules, weekly leaderboard.
 * Research-backed shape (docs: retention brief 2026-07-03): recommendation MODULES
 * over an infinite feed; cohort leaderboards with weekly resets over global all-time.
 * All read paths fail-open (empty arrays), never a page error.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Nightly: recompute Gig.trendingScore from real 7d signal (orders/saves/reviews)
 * with log(views) as a cold-start tiebreak. Deterministic and cheap. */
export async function recomputeTrending(): Promise<{ gigs: number }> {
  const d7 = new Date(Date.now() - 7 * DAY);
  const [orders, saves, reviews, gigs] = await Promise.all([
    prisma.order.groupBy({
      by: ["gigId"],
      where: { createdAt: { gte: d7 }, status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } },
      _count: true,
    }),
    prisma.savedGig.groupBy({ by: ["gigId"], where: { createdAt: { gte: d7 } }, _count: true }),
    prisma.review.groupBy({ by: ["gigId"], where: { createdAt: { gte: d7 } }, _count: true }),
    prisma.gig.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: { id: true, views: true },
    }),
  ]);
  const oBy = new Map(orders.map((r) => [r.gigId, r._count]));
  const sBy = new Map(saves.map((r) => [r.gigId, r._count]));
  const rBy = new Map(reviews.map((r) => [r.gigId, r._count]));

  let updated = 0;
  for (const g of gigs) {
    const score =
      (oBy.get(g.id) ?? 0) * 10 +
      (sBy.get(g.id) ?? 0) * 3 +
      (rBy.get(g.id) ?? 0) * 5 +
      Math.log10(g.views + 1); // tiebreak only — cumulative views can't dominate
    await prisma.gig.update({ where: { id: g.id }, data: { trendingScore: score } });
    updated += 1;
  }
  // Anything not ACTIVE falls out of trending entirely.
  await prisma.gig.updateMany({
    where: { OR: [{ status: { not: "ACTIVE" } }, { deletedAt: { not: null } }], trendingScore: { gt: 0 } },
    data: { trendingScore: 0 },
  });
  return { gigs: updated };
}

const GIG_CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  coverUrl: true,
  trendingScore: true,
  packages: { select: { priceUzs: true }, orderBy: { priceUzs: "asc" as const }, take: 1 },
  seller: { select: { username: true, firstName: true } },
} as const;

export type FeedGig = {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  fromUzs: number;
  sellerName: string;
};

function toCard(g: {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  packages: { priceUzs: number }[];
  seller: { username: string | null; firstName: string | null };
}): FeedGig {
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    coverUrl: g.coverUrl,
    fromUzs: g.packages[0]?.priceUzs ?? 0,
    sellerName: g.seller.username ? `@${g.seller.username}` : (g.seller.firstName ?? ""),
  };
}

/** Top trending active gigs (anon fallback + module filler). */
export async function trendingGigs(limit = 8): Promise<FeedGig[]> {
  const gigs = await prisma.gig.findMany({
    where: { status: "ACTIVE", deletedAt: null, trendingScore: { gt: 0 } },
    orderBy: { trendingScore: "desc" },
    take: limit,
    select: GIG_CARD_SELECT,
  });
  return gigs.map(toCard);
}

export interface FeedSections {
  fromFollowed: FeedGig[]; // newest gigs by sellers the user follows
  forYou: FeedGig[]; // top gigs in the user's interest categories (orders+saves)
  trending: FeedGig[]; // global trending (always present as fallback)
}

/** Personalized modules for a returning user. Every section independent + fail-open. */
export async function buildFeed(userId: string | null, limit = 6): Promise<FeedSections> {
  const trending = await trendingGigs(limit).catch(() => []);
  if (!userId) return { fromFollowed: [], forYou: [], trending };

  const [followed, interestCats] = await Promise.all([
    prisma.follow
      .findMany({ where: { followerId: userId }, select: { sellerId: true } })
      .catch(() => []),
    // Interest = categories of the user's own orders and saves (server truth).
    Promise.all([
      prisma.order.findMany({
        where: { buyerId: userId },
        select: { gig: { select: { categoryId: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.savedGig.findMany({
        where: { userId },
        select: { gig: { select: { categoryId: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]).then(([o, s]) =>
      [...new Set([...o, ...s].map((x) => x.gig.categoryId).filter((c): c is string => Boolean(c)))]
    ).catch(() => [] as string[]),
  ]);

  const [fromFollowed, forYou] = await Promise.all([
    followed.length
      ? prisma.gig
          .findMany({
            where: {
              sellerId: { in: followed.map((f) => f.sellerId) },
              status: "ACTIVE",
              deletedAt: null,
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            select: GIG_CARD_SELECT,
          })
          .then((g) => g.map(toCard))
          .catch(() => [])
      : Promise.resolve([]),
    interestCats.length
      ? prisma.gig
          .findMany({
            where: { categoryId: { in: interestCats }, status: "ACTIVE", deletedAt: null },
            orderBy: [{ trendingScore: "desc" }, { createdAt: "desc" }],
            take: limit,
            select: GIG_CARD_SELECT,
          })
          .then((g) => g.map(toCard))
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  // Dedupe across sections (priority: followed > forYou > trending).
  const seen = new Set<string>();
  const dedupe = (arr: FeedGig[]) => arr.filter((g) => !seen.has(g.id) && seen.add(g.id));
  return { fromFollowed: dedupe(fromFollowed), forYou: dedupe(forYou), trending: dedupe(trending) };
}

/** Monday (Tashkent, UTC+5) of the current week, stored at midnight UTC. */
function weekStartTashkent(now = new Date()): Date {
  const shifted = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const day = (shifted.getUTCDay() + 6) % 7; // Mon=0
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - day)
  );
}

/** Nightly: (re)rank this week's creators over a rolling 7d window. Weekly reset by key. */
export async function recomputeLeaderboard(): Promise<{ ranked: number }> {
  const d7 = new Date(Date.now() - 7 * DAY);
  const weekStart = weekStartTashkent();

  const completed = await prisma.order.groupBy({
    by: ["sellerId"],
    where: { status: "COMPLETED", createdAt: { gte: d7 } },
    _count: true,
  });
  if (completed.length === 0) return { ranked: 0 };

  const profiles = await prisma.sellerProfile.findMany({
    where: { userId: { in: completed.map((c) => c.sellerId) } },
    select: { userId: true, ratingAvg: true },
  });
  const ratingBy = new Map(profiles.map((p) => [p.userId, p.ratingAvg]));

  const ranked = completed
    .map((c) => ({
      sellerId: c.sellerId,
      completed: c._count,
      ratingAvg: ratingBy.get(c.sellerId) ?? 0,
      score: c._count * 10 + (ratingBy.get(c.sellerId) ?? 0) * 2,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  await prisma.$transaction([
    prisma.leaderboardEntry.deleteMany({ where: { weekStart } }),
    prisma.leaderboardEntry.createMany({
      data: ranked.map((r, i) => ({
        weekStart,
        sellerId: r.sellerId,
        rank: i + 1,
        score: r.score,
        completed: r.completed,
        ratingAvg: r.ratingAvg,
      })),
    }),
  ]);
  return { ranked: ranked.length };
}

/** This week's top creators, hydrated for display. */
export async function weeklyLeaderboard(limit = 10) {
  const weekStart = weekStartTashkent();
  const entries = await prisma.leaderboardEntry.findMany({
    where: { weekStart },
    orderBy: { rank: "asc" },
    take: limit,
  });
  if (entries.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: entries.map((e) => e.sellerId) }, status: "ACTIVE" },
    select: { id: true, username: true, firstName: true, image: true, photoUrl: true },
  });
  const uBy = new Map(users.map((u) => [u.id, u]));
  return entries
    .filter((e) => uBy.has(e.sellerId))
    .map((e) => ({ ...e, user: uBy.get(e.sellerId)! }));
}

/** The seller's own rank this week (null when unranked). */
export async function myWeeklyRank(sellerId: string): Promise<number | null> {
  const entry = await prisma.leaderboardEntry.findUnique({
    where: { weekStart_sellerId: { weekStart: weekStartTashkent(), sellerId } },
    select: { rank: true },
  });
  return entry?.rank ?? null;
}
