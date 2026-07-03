import type { User } from "@prisma/client";

/**
 * The moment we switched the platform bot from @aifrilance_bot to @gigoro_ai_bot
 * (2026-07). Telegram forbids a bot from messaging a user who hasn't opened *that*
 * bot, so a user whose last bot chat predates the switch (or is null) is unreachable
 * by the new bot until they open it. We prompt those users to reconnect.
 */
export const BOT_SWITCH_CUTOFF = new Date("2026-07-03T00:00:00Z");

/**
 * True for a Telegram-linked, notifications-enabled user who has not opened the NEW
 * bot since the switch — i.e. someone the new bot currently cannot push to. Drives
 * the reconnect banner; resolves itself once the user's /start stamps
 * `telegramLastChatAt` (via `stampTelegramChat`).
 */
export function needsBotReconnect(
  user: Pick<User, "telegramId" | "notifyTelegram" | "telegramLastChatAt">
): boolean {
  if (!user.telegramId || !user.notifyTelegram) return false;
  const last = user.telegramLastChatAt;
  return !last || last < BOT_SWITCH_CUTOFF;
}
