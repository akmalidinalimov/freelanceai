import "server-only";
import { prisma } from "@/lib/prisma";
import { BADGES } from "@/lib/badges";

/**
 * Gamification engine: XP, streaks, badges, profile completeness. All COSMETIC —
 * XP and badges have no monetary value and are never redeemable (e-money law;
 * docs/legal-notes.md). Everything is best-effort: a failed award must never
 * break an order, review, or page render.
 *
 * Award paths:
 *  - hooks: order paid → XP + first-order badge; review created → XP
 *  - touchStreak: piggybacks the throttled lastSeen touch (~1 write/user/15min max)
 *  - sweepBadges: nightly set-based evaluation of every count-based rule
 */

const XP = { orderPaid: 50, review: 15, dailyActive: 5, profileComplete: 20 } as const;

const VALID_KEYS = new Set(BADGES.map((b) => b.key));

/** Idempotent badge award (unique [userId,key]); returns true when newly earned. */
export async function awardBadge(userId: string, key: string): Promise<boolean> {
  if (!VALID_KEYS.has(key)) return false;
  try {
    const res = await prisma.userBadge.createMany({
      data: [{ userId, key }],
      skipDuplicates: true,
    });
    return res.count > 0;
  } catch {
    return false;
  }
}

export function addXp(userId: string, amount: number): void {
  void prisma.user
    .update({ where: { id: userId }, data: { xp: { increment: amount } } })
    .catch(() => {});
}

/** Tashkent-day (UTC+5) truncated to a stable Date key (midnight UTC of that day). */
export function tashkentDay(now = new Date()): Date {
  const shifted = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

/**
 * Maintain the daily streak. Called from the throttled lastSeen touch, so at most a
 * few writes per user per day. Yesterday → +1; a single missed day → streak kept
 * (grace, no increment); longer gap → reset to 1. First activity of the day earns XP.
 */
export async function touchStreak(userId: string): Promise<void> {
  try {
    const today = tashkentDay();
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastActiveDay: true, streakDays: true, streakBest: true },
    });
    if (!u) return;
    // lastActiveDay is already stored day-truncated — compare directly.
    const last = u.lastActiveDay ?? null;
    if (last && last.getTime() === today.getTime()) return; // already counted today

    const dayMs = 24 * 60 * 60 * 1000;
    const gap = last ? Math.round((today.getTime() - last.getTime()) / dayMs) : Infinity;
    const streakDays = gap === 1 ? u.streakDays + 1 : gap === 2 ? u.streakDays : 1;

    await prisma.user.update({
      where: { id: userId },
      data: {
        lastActiveDay: today,
        streakDays,
        streakBest: Math.max(u.streakBest, streakDays),
        xp: { increment: XP.dailyActive },
      },
    });
    if (streakDays >= 30) void awardBadge(userId, "streak_30").catch(() => {});
    else if (streakDays >= 7) void awardBadge(userId, "streak_7").catch(() => {});
  } catch {
    // cosmetic — never surfaces
  }
}

/** Hook: buyer's order reached payment. */
export function onOrderPaid(buyerId: string): void {
  addXp(buyerId, XP.orderPaid);
  void awardBadge(buyerId, "buyer_first_order").catch(() => {});
}

/** Hook: buyer wrote a review. */
export function onReviewCreated(authorId: string): void {
  addXp(authorId, XP.review);
}

export interface Completeness {
  score: number; // 0..100
  missing: string[]; // catalog keys of missing items (UI localizes)
}

const COMPLETENESS_ITEMS = [
  "headline",
  "bio",
  "specializations",
  "portfolio",
  "activeGig",
  "payout",
  "kyc",
  "phone",
] as const;

/** Seller profile completeness — the "fill the bar" mechanic + gates a badge/XP. */
export async function computeCompleteness(sellerId: string): Promise<Completeness> {
  const u = await prisma.user.findUnique({
    where: { id: sellerId },
    select: {
      phone: true,
      kycStatus: true,
      payoutCardMasked: true,
      sellerProfile: {
        select: {
          headline: true,
          bio: true,
          specializations: true,
          instagramUserId: true,
          _count: { select: { portfolio: true } },
        },
      },
      _count: { select: { gigs: true } },
    },
  });
  if (!u) return { score: 0, missing: [...COMPLETENESS_ITEMS] };
  const activeGigs = await prisma.gig.count({
    where: { sellerId, status: "ACTIVE", deletedAt: null },
  });

  const p = u.sellerProfile;
  const have: Record<(typeof COMPLETENESS_ITEMS)[number], boolean> = {
    headline: Boolean(p?.headline && p.headline.length >= 10),
    bio: Boolean(p?.bio && p.bio.length >= 80),
    specializations: (p?.specializations.length ?? 0) >= 1,
    portfolio: (p?._count.portfolio ?? 0) >= 1 || Boolean(p?.instagramUserId),
    activeGig: activeGigs >= 1,
    payout: Boolean(u.payoutCardMasked),
    kyc: u.kycStatus === "VERIFIED",
    phone: Boolean(u.phone),
  };
  const done = COMPLETENESS_ITEMS.filter((k) => have[k]);
  const missing = COMPLETENESS_ITEMS.filter((k) => !have[k]);
  const score = Math.round((done.length / COMPLETENESS_ITEMS.length) * 100);

  if (score === 100) {
    void awardBadge(sellerId, "seller_profile_complete")
      .then((fresh) => {
        if (fresh) addXp(sellerId, XP.profileComplete);
      })
      .catch(() => {}); // fire-and-forget cosmetic reward must never raise an unhandled rejection
  }
  return { score, missing: [...missing] };
}

/** Nightly set-based sweep of every count-based badge rule (idempotent). */
export async function sweepBadges(): Promise<{ awarded: number }> {
  const [sellerCounts, fiveStarRows, buyerCounts, buyerReviews, fastSellers] = await Promise.all([
    prisma.order.groupBy({ by: ["sellerId"], where: { status: "COMPLETED" }, _count: true }),
    // Review has no sellerId — reach the seller through the order.
    prisma.review.findMany({
      where: { rating: 5 },
      select: { order: { select: { sellerId: true } } },
    }),
    prisma.order.groupBy({
      by: ["buyerId"],
      // Disputed orders don't earn badges — only cleanly progressing/completed ones.
      where: { status: { notIn: ["PENDING_PAYMENT", "CANCELLED", "DISPUTED"] } },
      _count: true,
    }),
    prisma.review.groupBy({ by: ["authorId"], _count: true }),
    prisma.sellerProfile.findMany({
      where: { responseMins: { not: null, lte: 60 } },
      select: { userId: true },
    }),
  ]);

  const rows: Array<{ userId: string; key: string }> = [];
  for (const s of sellerCounts) {
    if (s._count >= 1) rows.push({ userId: s.sellerId, key: "seller_first_sale" });
    if (s._count >= 10) rows.push({ userId: s.sellerId, key: "seller_10_orders" });
    if (s._count >= 50) rows.push({ userId: s.sellerId, key: "seller_50_orders" });
  }
  const fiveStarBySeller = new Map<string, number>();
  for (const r of fiveStarRows) {
    const id = r.order.sellerId;
    fiveStarBySeller.set(id, (fiveStarBySeller.get(id) ?? 0) + 1);
  }
  for (const [sellerId, n] of fiveStarBySeller) {
    if (n >= 10) rows.push({ userId: sellerId, key: "seller_five_star_10" });
  }
  for (const b of buyerCounts) {
    if (b._count >= 1) rows.push({ userId: b.buyerId, key: "buyer_first_order" });
    if (b._count >= 5) rows.push({ userId: b.buyerId, key: "buyer_5_orders" });
  }
  for (const r of buyerReviews) if (r._count >= 10) rows.push({ userId: r.authorId, key: "buyer_10_reviews" });
  for (const s of fastSellers) rows.push({ userId: s.userId, key: "seller_fast_responder" });

  // Streak badges: backfill from streakBest so a lost fire-and-forget award in
  // touchStreak can never permanently deny an earned badge.
  const streakers = await prisma.user.findMany({
    where: { streakBest: { gte: 7 } },
    select: { id: true, streakBest: true },
  });
  for (const u of streakers) {
    rows.push({ userId: u.id, key: "streak_7" });
    if (u.streakBest >= 30) rows.push({ userId: u.id, key: "streak_30" });
  }

  if (rows.length === 0) return { awarded: 0 };
  const res = await prisma.userBadge.createMany({ data: rows, skipDuplicates: true });
  return { awarded: res.count };
}

/** Badges for display (profile/dashboard). */
export function getUserBadges(userId: string) {
  return prisma.userBadge.findMany({ where: { userId }, orderBy: { awardedAt: "asc" } });
}
