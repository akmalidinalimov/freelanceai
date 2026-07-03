import "server-only";
import { prisma } from "@/lib/prisma";
import type { BroadcastAudience, Prisma, User } from "@prisma/client";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";
import { tgSendResult } from "@/lib/telegram-bot";

/**
 * Admin broadcast to Telegram bot users. Queued (Broadcast row) and drained by a
 * throttled, resumable cron so a large send respects Telegram's ~30 msg/s limit,
 * survives restarts (cursor), never 429s hard, and prunes users who blocked the bot.
 */

const THROTTLE_MS = 60; // ~16/s — safely under the 30/s global ceiling
const BATCH = 100;
const TIME_BUDGET_MS = 80_000; // fit within the Cloudflare tunnel response window
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Recipient filter: reachable, not-blocked, Telegram-enabled, active accounts. */
export function audienceWhere(audience: BroadcastAudience): Prisma.UserWhereInput {
  const base: Prisma.UserWhereInput = {
    telegramId: { not: null },
    telegramBlockedAt: null,
    notifyTelegram: true,
    status: "ACTIVE",
  };
  if (audience === "BUYERS") return { ...base, isSeller: false };
  if (audience === "SELLERS") return { ...base, isSeller: true };
  if (audience === "ACTIVE_30D")
    return { ...base, lastSeenAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } };
  return base;
}

export function countRecipients(audience: BroadcastAudience): Promise<number> {
  return prisma.user.count({ where: audienceWhere(audience) });
}

export async function createBroadcast(
  admin: User,
  message: string,
  audience: BroadcastAudience,
  scheduledFor?: Date | null
) {
  if (admin.role !== "ADMIN") throw Errors.forbidden("Admins only");
  const trimmed = message.trim();
  if (trimmed.length < 3 || trimmed.length > 3000) throw Errors.validation({ message: "3–3000 chars" });
  // A schedule must be in the future; a past/absent time means send now.
  const scheduled = scheduledFor && scheduledFor.getTime() > Date.now() ? scheduledFor : null;
  const b = await prisma.broadcast.create({
    data: { message: trimmed, audience, createdById: admin.id, scheduledFor: scheduled },
  });
  await audit({ actorId: admin.id, action: "broadcast.create", entity: "Broadcast", entityId: b.id, metadata: { audience, scheduledFor: scheduled?.toISOString() ?? null } });
  return { broadcast: b, scheduled: Boolean(scheduled) };
}

// One global advisory lock for the whole broadcast drain — only ONE worker (the
// create-time kick OR the cron) ever sends at a time, so overlapping runs can't
// double-send the audience. Arbitrary constant key.
const BROADCAST_LOCK_KEY = 774_1001;

/**
 * Drain PENDING/SENDING broadcasts within a time budget. Serialized by a Postgres
 * advisory lock (no concurrent sends). Resumable via `cursor`, checkpointed every
 * batch so a mid-run crash re-sends at most one partial batch. Marks 403-blocked
 * users so future runs skip them.
 */
export async function processBroadcasts(): Promise<{ processed: number; sent: number; failed: number }> {
  const started = Date.now();
  let processed = 0;
  let sent = 0;
  let failed = 0;

  // Try to acquire the global lock; if another worker holds it, bail (it's draining).
  const [lock] = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(${BROADCAST_LOCK_KEY}) AS locked`;
  if (!lock?.locked) return { processed, sent, failed };

  try {
    const b = await prisma.broadcast.findFirst({
      // Skip broadcasts scheduled for the future — they become eligible once their time
      // arrives (the hourly-or-sooner cron picks them up then).
      where: {
        status: { in: ["PENDING", "SENDING"] },
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
      },
      orderBy: { createdAt: "asc" },
    });
    if (!b) return { processed, sent, failed };

    if (b.status === "PENDING") {
      await prisma.broadcast.update({ where: { id: b.id }, data: { status: "SENDING", startedAt: new Date() } });
    }

    let cursor = b.cursor ?? undefined;
    const where = audienceWhere(b.audience);

    for (;;) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        await prisma.broadcast.update({
          where: { id: b.id },
          data: { cursor, sentCount: { increment: sent }, failedCount: { increment: failed } },
        });
        return { processed, sent, failed }; // resume next tick (holds the lock till finally)
      }
      const batch = await prisma.user.findMany({
        where,
        select: { id: true, telegramId: true },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;

      let batchSent = 0;
      let batchFailed = 0;
      for (const u of batch) {
        cursor = u.id;
        if (!u.telegramId) continue;
        const res = await tgSendResult(u.telegramId, b.message);
        if (res.ok) {
          batchSent += 1;
        } else if (res.blocked) {
          batchFailed += 1;
          await prisma.user.update({ where: { id: u.id }, data: { telegramBlockedAt: new Date() } }).catch(() => {});
        } else if (res.retryAfter) {
          await sleep((res.retryAfter + 1) * 1000); // honor flood wait, then retry once
          const retry = await tgSendResult(u.telegramId, b.message);
          retry.ok ? (batchSent += 1) : (batchFailed += 1);
        } else {
          batchFailed += 1;
        }
        processed += 1;
        await sleep(THROTTLE_MS);
      }
      // Checkpoint per batch: advance the cursor + persist counts so a crash re-sends
      // at most this batch (bounds partial-batch duplication).
      sent += batchSent;
      failed += batchFailed;
      await prisma.broadcast.update({
        where: { id: b.id },
        data: { cursor, sentCount: { increment: batchSent }, failedCount: { increment: batchFailed } },
      });
    }

    await prisma.broadcast.update({
      where: { id: b.id },
      data: { status: "DONE", doneAt: new Date(), cursor },
    });
    return { processed, sent, failed };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${BROADCAST_LOCK_KEY})`.catch(() => {});
  }
}

export function listBroadcasts(limit = 30) {
  return prisma.broadcast.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}
