import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Product-analytics writes. All best-effort: analytics must NEVER break a user flow,
 * so every write swallows errors (a lost event beats a failed order).
 */

/** Client-emittable event types (via POST /api/events). Server-side conversions
 * (order_created, order_paid) are written directly by their services instead —
 * clients can't forge funnel denominators they don't own. */
export const CLIENT_EVENT_TYPES = ["order_cta_click", "contact_cta_click"] as const;
export type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];

export async function trackEvent(
  type: string,
  opts: { userId?: string | null; entityId?: string | null; meta?: Record<string, unknown> } = {}
): Promise<void> {
  try {
    await prisma.activityEvent.create({
      data: {
        type,
        userId: opts.userId ?? null,
        entityId: opts.entityId ?? null,
        meta: opts.meta as never,
      },
    });
  } catch {
    // best-effort
  }
}

// lastSeenAt is touched at most once per THROTTLE window per user (in-memory guard —
// single app instance). Keeps a hot page from turning every request into a DB write.
const THROTTLE_MS = 15 * 60 * 1000;
const lastTouch = new Map<string, number>();

export function touchLastSeen(userId: string): void {
  const now = Date.now();
  const prev = lastTouch.get(userId) ?? 0;
  if (now - prev < THROTTLE_MS) return;
  lastTouch.set(userId, now);
  if (lastTouch.size > 20_000) lastTouch.clear(); // bound the map under abuse
  void prisma.user
    .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
    .catch(() => {});
}

export function stampLastLogin(userId: string): void {
  void prisma.user
    .update({ where: { id: userId }, data: { lastLoginAt: new Date(), lastSeenAt: new Date() } })
    .catch(() => {});
}

export function stampTelegramChat(telegramId: string): void {
  void prisma.user
    .updateMany({ where: { telegramId }, data: { telegramLastChatAt: new Date() } })
    .catch(() => {});
}
