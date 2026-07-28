import "server-only";
import { prisma } from "@/lib/prisma";
import { REFEREE_WELCOME_UZS } from "@/server/services/affiliate";

function genCode(): string {
  // Server code (not the workflow sandbox) — Math.random is fine here.
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Ensure the user has a referral code (generated lazily), plus their referral count. */
export async function getReferralInfo(userId: string): Promise<{ code: string | null; count: number }> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  let code = u?.referralCode ?? null;
  for (let i = 0; i < 5 && !code; i++) {
    const candidate = genCode();
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: candidate } });
      code = candidate;
    } catch {
      /* unique collision — retry */
    }
  }
  const count = await prisma.user.count({ where: { referredById: userId } });
  return { code, count };
}

/** Resolve a referral code to the referrer's user id (or null). */
export async function referrerIdForCode(code: string): Promise<string | null> {
  if (!code) return null;
  const u = await prisma.user.findUnique({
    where: { referralCode: code.toUpperCase() },
    select: { id: true },
  });
  return u?.id ?? null;
}

/**
 * Attribute a referral (set-once) AND grant the referee their welcome credit — atomically,
 * so a concurrent double-call can't double-grant (the `referredById: null` guard only lets
 * the first write through). Only when the user has no referrer and it isn't themselves.
 */
export async function applyReferral(userId: string, referrerId: string): Promise<void> {
  if (!referrerId || userId === referrerId) return;
  try {
    const ref = await prisma.user.findUnique({ where: { id: referrerId }, select: { id: true } });
    if (!ref) return;
    await prisma.user.updateMany({
      where: { id: userId, referredById: null },
      data: { referredById: referrerId, creditBalanceUzs: { increment: REFEREE_WELCOME_UZS } },
    });
  } catch {
    /* best-effort */
  }
}
