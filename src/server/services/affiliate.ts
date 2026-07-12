import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { notifyAndPush } from "@/server/services/notification";

/**
 * Affiliate credit economics. All rewards are funded from the PLATFORM take-rate (never the
 * seller's cut) and paid as non-withdrawable, on-platform CREDIT (not cash / not e-money —
 * legally the same as a platform-funded coupon; see docs/legal-uz-requirements.md).
 */
export const REFEREE_WELCOME_UZS = 30_000; // credit a user gets for signing up via a referral
const REFERRER_PCT = 0.4; // referrer earns 40% of the referred order's platform commission…
const REFERRER_CAP_UZS = 50_000; // …capped per referred user
const MONTHLY_REWARD_CAP = 20; // max rewarded referrals per referrer / rolling 30 days (anti-fraud)

/**
 * On a referred buyer's FIRST completed order, credit the referrer. Idempotent + atomic: the
 * unique `refereeId` row prevents double-issue even across concurrent completions (a second
 * completed order by the same referee hits the unique constraint → no-op). Best-effort:
 * a failure here never breaks order completion. Rewards drawn from the platform commission.
 */
export async function issueReferralReward(order: {
  id: string;
  buyerId: string;
  commissionUzs: number;
}): Promise<void> {
  try {
    const buyer = await prisma.user.findUnique({
      where: { id: order.buyerId },
      select: { referredById: true },
    });
    const referrerId = buyer?.referredById;
    if (!referrerId || referrerId === order.buyerId) return; // no referrer, or self-referral

    // Anti-fraud: cap rewarded referrals per referrer per rolling 30 days.
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const recent = await prisma.referralReward.count({ where: { referrerId, createdAt: { gte: since } } });
    if (recent >= MONTHLY_REWARD_CAP) return;

    const amount = Math.min(REFERRER_CAP_UZS, Math.round(order.commissionUzs * REFERRER_PCT));
    if (amount <= 0) return;

    // Create the (unique-per-referee) reward row AND credit the referrer atomically. If the
    // referee already earned a reward, the unique constraint throws and both roll back.
    await prisma.$transaction([
      prisma.referralReward.create({
        data: { referrerId, refereeId: order.buyerId, orderId: order.id, amountUzs: amount },
      }),
      prisma.user.update({
        where: { id: referrerId },
        data: { creditBalanceUzs: { increment: amount } },
      }),
    ]);
    await audit({ actorId: referrerId, action: "referral.reward", entity: "ReferralReward", entityId: order.id });
    await notifyAndPush(referrerId, "referral.reward", "🎉 Referal mukofoti", {
      body: `Taklif qilgan doʻstingiz buyurtma berdi — hisobingizga ${amount.toLocaleString("ru-RU")} soʻm kredit qoʻshildi.`,
      link: "/dashboard",
    });
  } catch (err) {
    // P2002 on refereeId = already rewarded → intended idempotent no-op. Log anything else.
    if ((err as { code?: string })?.code !== "P2002") {
      logger.warn("referral_reward_failed", { orderId: order.id, err: String(err) });
    }
  }
}

/**
 * Restore credit that was spent on an order which is being refunded/cancelled (post-payment),
 * so the buyer doesn't lose their credit. Idempotent: zeroes `creditUsedUzs` in the same
 * write so a re-run can't double-restore. Runs inside the caller's refund transaction.
 */
export async function restoreOrderCredit(
  tx: Prisma.TransactionClient,
  order: { id: string; buyerId: string; creditUsedUzs: number }
): Promise<void> {
  if (order.creditUsedUzs <= 0) return;
  const res = await tx.order.updateMany({
    where: { id: order.id, creditUsedUzs: order.creditUsedUzs },
    data: { creditUsedUzs: 0 },
  });
  if (res.count === 0) return; // already restored (race) → no double-credit
  await tx.user.update({
    where: { id: order.buyerId },
    data: { creditBalanceUzs: { increment: order.creditUsedUzs } },
  });
}

/**
 * Compute + atomically consume the buyer's available credit as a platform-funded discount,
 * INSIDE the order-creation transaction. Capped at the order's platform commission so the
 * platform keeps ≥0 and the seller's net is never touched. The conditional decrement is
 * race-safe. Returns the credit actually applied (UZS).
 */
export async function consumeCreditForOrder(
  tx: Prisma.TransactionClient,
  buyerId: string,
  commissionUzs: number,
  existingDiscountUzs: number
): Promise<number> {
  const buyer = await tx.user.findUnique({ where: { id: buyerId }, select: { creditBalanceUzs: true } });
  const balance = buyer?.creditBalanceUzs ?? 0;
  const headroom = Math.max(0, commissionUzs - existingDiscountUzs); // keep platform commission ≥ 0
  const applied = Math.min(balance, headroom);
  if (applied <= 0) return 0;
  const res = await tx.user.updateMany({
    where: { id: buyerId, creditBalanceUzs: { gte: applied } },
    data: { creditBalanceUzs: { decrement: applied } },
  });
  return res.count > 0 ? applied : 0;
}

/** Referrer's credit balance + total lifetime credit earned + number of rewarded referrals. */
export async function getAffiliateSummary(userId: string): Promise<{
  balanceUzs: number;
  earnedUzs: number;
  rewardedReferrals: number;
}> {
  const [u, agg] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { creditBalanceUzs: true } }),
    prisma.referralReward.aggregate({ where: { referrerId: userId }, _sum: { amountUzs: true }, _count: true }),
  ]);
  return {
    balanceUzs: u?.creditBalanceUzs ?? 0,
    earnedUzs: agg._sum.amountUzs ?? 0,
    rewardedReferrals: agg._count,
  };
}
