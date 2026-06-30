import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * In-app notifications. `notify` is best-effort (a failure here must never break the
 * order/review/message flow that triggered it), so it swallows + logs errors.
 */
export async function notify(
  userId: string,
  type: string,
  title: string,
  opts?: { body?: string; link?: string }
): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, type, title, body: opts?.body ?? null, link: opts?.link ?? null },
    });
  } catch (err) {
    logger.warn("notify_failed", { userId, type, err: String(err) });
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
