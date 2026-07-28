import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { tgSendMessage, tgOpenButton } from "@/lib/telegram-bot";

/**
 * In-app notifications. `notify` is best-effort (a failure here must never break the
 * order/review/message flow that triggered it), so it swallows + logs errors.
 */
/** Map a notification type to a user-mutable category. */
export function notificationCategory(type: string): "messages" | "reviews" | "orders" {
  if (type.startsWith("message.")) return "messages";
  if (type.startsWith("review.")) return "reviews";
  return "orders"; // order.*, dispute.*, cancellation.*
}

export async function notify(
  userId: string,
  type: string,
  title: string,
  opts?: { body?: string; link?: string }
): Promise<void> {
  try {
    // Respect the recipient's per-category mutes (default: everything on).
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { notifyPrefs: true } });
    const prefs = (u?.notifyPrefs as Record<string, boolean> | null) ?? null;
    if (prefs && prefs[notificationCategory(type)] === false) return;
    await prisma.notification.create({
      data: { userId, type, title, body: opts?.body ?? null, link: opts?.link ?? null },
    });
  } catch (err) {
    logger.warn("notify_failed", { userId, type, err: String(err) });
  }
}

/**
 * In-app notification PLUS a Telegram push (pref-gated), with an "open in app" button
 * that deep-links the Mini App. Use for events that should reach the user's phone
 * (order lifecycle, reminders, review nudges). Best-effort end to end.
 */
export async function notifyAndPush(
  userId: string,
  type: string,
  title: string,
  opts?: { body?: string; link?: string; buttons?: Record<string, unknown>[][] }
): Promise<void> {
  await notify(userId, type, title, opts);
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true, notifyTelegram: true, notifyPrefs: true, locale: true },
    });
    if (!u?.telegramId || !u.notifyTelegram) return;
    const prefs = (u.notifyPrefs as Record<string, boolean> | null) ?? null;
    if (prefs && prefs[notificationCategory(type)] === false) return;
    const text = opts?.body ? `${title}\n\n${opts.body}` : title;
    // Inline action buttons (callback_data) take precedence over the plain "open" button —
    // they turn the notification into a one-tap action (accept delivery, rate, …).
    const markup = opts?.buttons
      ? { inline_keyboard: opts.buttons }
      : opts?.link
        ? tgOpenButton(u.locale, opts.link)
        : undefined;
    await tgSendMessage(u.telegramId, text, markup);
  } catch (err) {
    logger.warn("notify_push_failed", { userId, type, err: String(err) });
  }
}

/**
 * Fan a notification out to every Telegram-reachable ADMIN (in-app + bot push) — for ops
 * alerts that need admin action (gig review, dispute, payout, KYC). Best-effort per admin;
 * one failure never blocks the flow that triggered it.
 */
export async function notifyAdmins(
  type: string,
  title: string,
  opts?: { body?: string; link?: string; buttons?: Record<string, unknown>[][] }
): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: "ADMIN",
        status: "ACTIVE",
        telegramId: { not: null },
        notifyTelegram: true,
        telegramBlockedAt: null,
      },
      select: { id: true },
    });
    await Promise.all(admins.map((a) => notifyAndPush(a.id, type, title, opts)));
  } catch (err) {
    logger.warn("notify_admins_failed", { type, err: String(err) });
  }
}

export async function listNotifications(userId: string, limit = 30) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

/** Delete a single notification — scoped to the owner (no IDOR). */
export async function deleteNotification(userId: string, id: string): Promise<void> {
  await prisma.notification.deleteMany({ where: { id, userId } });
}

/** Delete all of the current user's notifications. */
export async function clearNotifications(userId: string): Promise<void> {
  await prisma.notification.deleteMany({ where: { userId } });
}
