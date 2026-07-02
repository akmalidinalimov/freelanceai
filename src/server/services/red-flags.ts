import "server-only";
import { prisma } from "@/lib/prisma";
import type { FlagSeverity } from "@prisma/client";

/**
 * Deterministic trust & safety signals, recomputed from scratch on every scan
 * (nightly cron + admin on-demand). Signals are evidence-based counters — no ML,
 * no guesswork — so an admin can always trace WHY a user is flagged. The scan is
 * idempotent: it replaces the whole UserFlag table with the current truth.
 */

const DAY = 24 * 60 * 60 * 1000;

interface Flag {
  userId: string;
  type: string;
  severity: FlagSeverity;
  details: Record<string, number | string>;
}

/** All signal queries are set-based (no per-user loops). */
async function computeFlags(): Promise<Flag[]> {
  const now = Date.now();
  const d30 = new Date(now - 30 * DAY);
  const d1 = new Date(now - 1 * DAY);
  const d7 = new Date(now - 7 * DAY);

  const [redactions, disputes, refunds, contactsByBuyer, paidBuyers, rapidContacts, newHighValue] =
    await Promise.all([
      // Contact-info redactions in the last 30 days (off-platform bypass attempts).
      prisma.activityEvent.groupBy({
        by: ["userId"],
        where: { type: "message_redacted", createdAt: { gte: d30 }, userId: { not: null } },
        _count: true,
      }),
      // Dispute RECORDS per participant (all time). Not current order status —
      // resolved disputes must keep counting or serial offenders never flag.
      prisma.dispute.findMany({
        select: { order: { select: { buyerId: true, sellerId: true } } },
      }),
      // Succeeded refunds per buyer (all time).
      prisma.transaction.findMany({
        where: { type: "REFUND", status: "SUCCEEDED" },
        select: { order: { select: { buyerId: true } } },
      }),
      // Direct conversations started per buyer.
      prisma.conversation.groupBy({
        by: ["buyerId"],
        where: { buyerId: { not: null } },
        _count: true,
      }),
      // Buyers whose money actually arrived (refunded-then-cancelled orders count —
      // status-based checks would falsely mark refunded buyers as "never paid").
      prisma.transaction.findMany({
        where: { type: "PAYMENT_IN", status: "SUCCEEDED" },
        select: { order: { select: { buyerId: true } } },
      }),
      // Conversations opened in the last 24h per buyer (contact spam).
      prisma.conversation.groupBy({
        by: ["buyerId"],
        where: { buyerId: { not: null }, createdAt: { gte: d1 } },
        _count: true,
      }),
      // Accounts younger than 7 days with significant paid volume.
      prisma.order.groupBy({
        by: ["buyerId"],
        where: {
          status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] },
          buyer: { createdAt: { gte: d7 } },
        },
        _sum: { amountUzs: true },
      }),
    ]);

  const flags: Flag[] = [];

  for (const r of redactions) {
    if (!r.userId || r._count < 3) continue;
    flags.push({
      userId: r.userId,
      type: "CONTACT_REDACTED",
      severity: r._count >= 10 ? "HIGH" : "MEDIUM",
      details: { redactedMessages30d: r._count },
    });
  }

  const disputeCount = new Map<string, number>();
  for (const d of disputes) {
    if (!d.order) continue;
    disputeCount.set(d.order.buyerId, (disputeCount.get(d.order.buyerId) ?? 0) + 1);
    disputeCount.set(d.order.sellerId, (disputeCount.get(d.order.sellerId) ?? 0) + 1);
  }
  for (const [userId, count] of disputeCount) {
    if (count < 2) continue;
    flags.push({
      userId,
      type: "HIGH_DISPUTE",
      severity: count >= 4 ? "HIGH" : "MEDIUM",
      details: { disputedOrders: count },
    });
  }

  const refundCount = new Map<string, number>();
  for (const r of refunds) {
    const id = r.order?.buyerId;
    if (id) refundCount.set(id, (refundCount.get(id) ?? 0) + 1);
  }
  for (const [userId, count] of refundCount) {
    if (count < 2) continue;
    flags.push({
      userId,
      type: "REFUND_HEAVY",
      severity: count >= 4 ? "HIGH" : "MEDIUM",
      details: { refunds: count },
    });
  }

  const paidBuyerSet = new Set(
    paidBuyers.map((t) => t.order?.buyerId).filter((id): id is string => Boolean(id))
  );
  for (const c of contactsByBuyer) {
    if (!c.buyerId || c._count < 5 || paidBuyerSet.has(c.buyerId)) continue;
    flags.push({
      userId: c.buyerId,
      type: "CONTACTS_NO_ORDERS",
      severity: c._count >= 15 ? "HIGH" : "MEDIUM",
      details: { conversations: c._count, paidOrders: 0 },
    });
  }

  for (const c of rapidContacts) {
    if (!c.buyerId || c._count < 10) continue;
    flags.push({
      userId: c.buyerId,
      type: "RAPID_CONTACTS",
      severity: "HIGH",
      details: { conversations24h: c._count },
    });
  }

  for (const g of newHighValue) {
    const sum = g._sum.amountUzs ?? 0;
    if (sum < 5_000_000) continue; // ≥5M UZS in the first week
    flags.push({
      userId: g.buyerId,
      type: "NEW_ACCOUNT_HIGH_VALUE",
      severity: "MEDIUM",
      details: { paidUzsFirstWeek: sum },
    });
  }

  return flags;
}

/** Recompute all flags. Returns counts for the cron response / audit trail. */
export async function scanRedFlags(): Promise<{ flagged: number; flags: number }> {
  const flags = await computeFlags();
  await prisma.$transaction([
    prisma.userFlag.deleteMany({}),
    prisma.userFlag.createMany({
      data: flags.map((f) => ({
        userId: f.userId,
        type: f.type,
        severity: f.severity,
        details: f.details,
      })),
    }),
  ]);
  return { flagged: new Set(flags.map((f) => f.userId)).size, flags: flags.length };
}

/** Active flags grouped per user for the admin panel, most severe first. */
export async function listFlaggedUsers() {
  const flags = await prisma.userFlag.findMany({
    include: {
      user: { select: { id: true, username: true, firstName: true, email: true, status: true } },
    },
    orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
  });
  const byUser = new Map<string, { user: (typeof flags)[number]["user"]; flags: typeof flags }>();
  for (const f of flags) {
    const entry = byUser.get(f.userId) ?? { user: f.user, flags: [] as typeof flags };
    entry.flags.push(f);
    byUser.set(f.userId, entry);
  }
  // HIGH-severity users first, then by flag count.
  const rank = { HIGH: 2, MEDIUM: 1, LOW: 0 } as const;
  return [...byUser.values()].sort((a, b) => {
    const ra = Math.max(...a.flags.map((f) => rank[f.severity]));
    const rb = Math.max(...b.flags.map((f) => rank[f.severity]));
    return rb - ra || b.flags.length - a.flags.length;
  });
}

/** Flags for one user (admin user-detail page). */
export function getUserFlags(userId: string) {
  return prisma.userFlag.findMany({
    where: { userId },
    orderBy: { severity: "desc" },
  });
}
