import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * One-time backfill: mark existing Telegram accounts as onboarded.
 *
 * WHY. New Telegram accounts are now created with `onboardingCompleted: true`, because Telegram
 * already tells us the name and there is nothing worth asking before someone browses. Every account
 * created BEFORE that change still carries `false`, and the webhook's `/start` handler treats that
 * as "unfinished profile": it sends the onboarding nudge and RETURNS EARLY, so those users get no
 * welcome, no refreshed reply keyboard and no menu button — and land in a registration form we
 * decided nobody needs. The wall we removed is still standing for everyone who signed up earlier.
 *
 * Scoped strictly to accounts with a `telegramId`. Email and Google users legitimately still see
 * onboarding: nothing told us their name or what they came to do, which is the case the form exists
 * for.
 *
 * Silent and idempotent. It writes one boolean, sends nothing, and a second run matches zero rows.
 */
export type OnboardingBackfillResult = {
  /** Telegram accounts still marked unfinished before this ran. */
  pending: number;
  /** Rows actually updated. */
  updated: number;
};

/** The accounts this touches. Exported so tests assert the rule rather than restate it. */
export const TELEGRAM_UNONBOARDED = {
  telegramId: { not: null },
  onboardingCompleted: false,
} as const;

export async function countUnonboardedTelegramUsers(): Promise<number> {
  return prisma.user.count({ where: TELEGRAM_UNONBOARDED });
}

export async function backfillTelegramOnboarding(): Promise<OnboardingBackfillResult> {
  const pending = await countUnonboardedTelegramUsers();
  // A single conditional UPDATE: no read-then-write window, and safe to run twice.
  const res = await prisma.user.updateMany({
    where: TELEGRAM_UNONBOARDED,
    data: { onboardingCompleted: true },
  });
  return { pending, updated: res.count };
}
