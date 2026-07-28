import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Product-analytics writes. All best-effort: analytics must NEVER break a user flow,
 * so every write swallows errors (a lost event beats a failed order).
 */

/** Client-emittable event types (via POST /api/events). Server-side conversions
 * (order_created, order_paid) are written directly by their services instead —
 * clients can't forge funnel denominators they don't own. */
export const CLIENT_EVENT_TYPES = ["order_cta_click", "contact_cta_click", "share"] as const;
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
  // Bound the map by sweeping EXPIRED entries only (a wholesale clear would wipe fresh
  // throttle state and cause a write burst from every active user at once).
  if (lastTouch.size > 20_000) {
    for (const [k, t] of lastTouch) if (now - t >= THROTTLE_MS) lastTouch.delete(k);
  }
  lastTouch.set(userId, now);
  void prisma.user
    .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
    .catch(() => {});
  // Streak/XP maintenance piggybacks the same throttle window (dynamic import
  // avoids a static cycle only in spirit — gamification is a leaf module).
  void import("@/server/services/gamification").then((g) => g.touchStreak(userId)).catch(() => {});
  void recordDeviceSighting(userId);
}

/**
 * Security telemetry: hash the caller's IP+UA (never stored raw — SHA-256 prefix
 * only) and record a `device_seen` event the FIRST time this device appears for the
 * user in 90 days. Distinct new devices in a short window feed the NEW_DEVICE_BURST
 * red-flag signal (account sharing / takeover indicator). Fails silently outside a
 * request scope (cron) or on any error — telemetry must never break a page.
 */
async function recordDeviceSighting(userId: string): Promise<void> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const ua = h.get("user-agent") ?? "";
    if (!ip && !ua) return;
    // /16-truncate IPv4 so Uzbek carrier CG-NAT pool rotation doesn't mint a "new
    // device" per session; HMAC with a server pepper so a DB leak can't be
    // dictionary-tested against candidate IP+UA pairs.
    const ipNet = ip.includes(".") ? ip.split(".").slice(0, 2).join(".") : ip.split(":").slice(0, 3).join(":");
    const { createHmac } = await import("node:crypto");
    const pepper = process.env.AUTH_SECRET ?? "device-pepper";
    const hash = createHmac("sha256", pepper).update(`${ipNet}|${ua}`).digest("hex").slice(0, 32);

    const seen = await prisma.activityEvent.findFirst({
      where: {
        userId,
        type: "device_seen",
        entityId: hash,
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (!seen) {
      await prisma.activityEvent.create({
        data: { userId, type: "device_seen", entityId: hash },
      });
    }
  } catch {
    // outside request scope or transient failure — skip
  }
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
