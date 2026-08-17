import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { tgSetChatMenuButtonResult } from "@/lib/telegram-bot";

/**
 * One-off backfill of the Telegram chat Menu Button for already-paired users.
 *
 * WHY THIS EXISTS. `setChatMenuButton` is scoped to a chat, and the webhook only calls it when
 * a user messages the bot. Telegram then stores that button server-side, forever, with whatever
 * URL the code produced at that moment. So when the Mini App marker (`?tgapp=1`) was added, every
 * user who had already paired kept an unmarked URL — and an unmarked launch renders our web chrome
 * server-side before the client suppresses it, i.e. a visible flash on EVERY launch, not once.
 *
 * Safe to re-run. Setting the same button twice is a no-op and sends the user nothing, so a
 * partial run can simply be repeated from the start; a cursor is offered to save work, not to
 * protect correctness.
 *
 * The reply keyboard has the same staleness problem but cannot be fixed silently — it only
 * changes when the bot sends a message. It self-heals instead: once this backfill gives a user a
 * marked menu button, their first launch through it sets the marker cookie, and the middleware
 * then marks subsequent keyboard launches from the cookie.
 */

const THROTTLE_MS = 60; // ~16/s, matching the broadcast drain's headroom under Telegram's ceiling
const BATCH = 100;
const TIME_BUDGET_MS = 80_000; // fit inside the Cloudflare tunnel response window
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Distinct from BROADCAST_LOCK_KEY: this drain may safely run while a broadcast does not, but
// two copies of THIS job must not overlap and burn rate limit on the same users.
const MENU_BUTTON_LOCK_KEY = 774_1002;

/**
 * Who gets a button. Deliberately NOT filtered by `notifyTelegram`: the menu button is interface
 * configuration, not a notification, and a user who muted our messages still opens the Mini App.
 */
export function menuButtonAudience(): Prisma.UserWhereInput {
  return { telegramId: { not: null }, telegramBlockedAt: null, status: "ACTIVE" };
}

export function countMenuButtonTargets(): Promise<number> {
  return prisma.user.count({ where: menuButtonAudience() });
}

export type MenuButtonSyncResult = {
  processed: number;
  ok: number;
  failed: number;
  blocked: number;
  nextCursor: string | null;
  done: boolean;
  skipped?: "locked";
};

/**
 * Push a current, marked menu button to every paired user, within a time budget.
 * Returns `done: false` with a `nextCursor` when the budget runs out — call again with it.
 */
export async function syncChatMenuButtons(
  opts: { cursor?: string | null; budgetMs?: number } = {}
): Promise<MenuButtonSyncResult> {
  const started = Date.now();
  const budget = opts.budgetMs ?? TIME_BUDGET_MS;
  let processed = 0;
  let ok = 0;
  let failed = 0;
  let blocked = 0;
  let cursor = opts.cursor ?? undefined;

  const [lock] = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(${MENU_BUTTON_LOCK_KEY}) AS locked`;
  if (!lock?.locked) {
    return { processed, ok, failed, blocked, nextCursor: cursor ?? null, done: false, skipped: "locked" };
  }

  try {
    const where = menuButtonAudience();
    for (;;) {
      if (Date.now() - started > budget) {
        return { processed, ok, failed, blocked, nextCursor: cursor ?? null, done: false };
      }
      const batch = await prisma.user.findMany({
        where,
        select: { id: true, telegramId: true, locale: true },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;

      for (const u of batch) {
        cursor = u.id;
        if (!u.telegramId) continue;
        let res = await tgSetChatMenuButtonResult(u.telegramId, u.locale);
        if (!res.ok && res.retryAfter) {
          await sleep((res.retryAfter + 1) * 1000); // honour the flood wait, then retry once
          res = await tgSetChatMenuButtonResult(u.telegramId, u.locale);
        }
        if (res.ok) {
          ok += 1;
        } else if (res.blocked) {
          // The user blocked the bot. Record it so this and every other fan-out skips them.
          blocked += 1;
          await prisma.user
            .update({ where: { id: u.id }, data: { telegramBlockedAt: new Date() } })
            .catch(() => {});
        } else {
          failed += 1;
        }
        processed += 1;
        await sleep(THROTTLE_MS);
      }
    }
    return { processed, ok, failed, blocked, nextCursor: cursor ?? null, done: true };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${MENU_BUTTON_LOCK_KEY})`.catch(() => {});
  }
}
