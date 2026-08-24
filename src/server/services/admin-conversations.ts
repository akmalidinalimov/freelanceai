import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma, type User } from "@prisma/client";
import { Errors } from "@/lib/api";

/**
 * Admin, read-only access to buyer↔seller conversations plus relationship/category
 * statistics. Chat access is for moderation/fraud review ONLY: every transcript read
 * is written to the append-only audit log (who, which conversation, when), and there
 * is deliberately no admin write/delete path for messages.
 */

// Statuses where money actually entered the platform (everything after checkout).
const PAID_STATUSES = [
  "PAID",
  "IN_PROGRESS",
  "DELIVERED",
  "REVISION",
  "COMPLETED",
  "DISPUTED",
] as const;

const userBrief = { select: { id: true, username: true, firstName: true, email: true } };

/**
 * Latest conversations by LAST ACTIVITY, optionally filtered to one user (either side,
 * incl. order-scoped). Ordering happens in SQL over the whole table — a moderation list
 * ordered by "last activity" must not silently drop an old-but-active thread, which is
 * exactly the thread a moderator needs (off-platform-payment chatter revives old convos).
 */
export async function listConversationsForAdmin(userId?: string) {
  const uid = userId?.trim() || null;
  const ranked = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT c."id"
    FROM "Conversation" c
    LEFT JOIN "Order" o ON o."id" = c."orderId"
    WHERE ${uid}::text IS NULL
       OR c."buyerId" = ${uid} OR c."sellerId" = ${uid}
       OR o."buyerId" = ${uid} OR o."sellerId" = ${uid}
    ORDER BY COALESCE(
      (SELECT MAX(m."createdAt") FROM "Message" m WHERE m."conversationId" = c."id"),
      c."createdAt"
    ) DESC
    LIMIT 200
  `);
  const ids = ranked.map((r) => r.id);
  if (ids.length === 0) return [];

  const convos = await prisma.conversation.findMany({
    where: { id: { in: ids } },
    include: {
      buyer: userBrief,
      seller: userBrief,
      gig: { select: { title: true, slug: true } },
      order: {
        select: {
          id: true,
          status: true,
          amountUzs: true,
          buyer: userBrief,
          seller: userBrief,
          gig: { select: { title: true, slug: true } },
        },
      },
      _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  return convos
    .map((c) => ({
      id: c.id,
      // Order-scoped conversations derive participants from the order.
      buyer: c.buyer ?? c.order?.buyer ?? null,
      seller: c.seller ?? c.order?.seller ?? null,
      gigTitle: c.gig?.title ?? c.order?.gig?.title ?? null,
      order: c.order ? { id: c.order.id, status: c.order.status, amountUzs: c.order.amountUzs } : null,
      messageCount: c._count.messages,
      lastMessageAt: c.messages[0]?.createdAt ?? c.createdAt,
      createdAt: c.createdAt,
    }))
    .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
}

/**
 * Full transcript for one conversation. AUDIT-LOGGED: records the reading admin and
 * the conversation before returning anything. Caps at the most recent 500 messages.
 */
export async function getConversationForAdmin(admin: User, conversationId: string) {
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      buyer: userBrief,
      seller: userBrief,
      gig: { select: { title: true, slug: true } },
      order: {
        select: {
          id: true,
          status: true,
          amountUzs: true,
          buyer: userBrief,
          seller: userBrief,
          gig: { select: { title: true, slug: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 500,
        select: {
          id: true,
          senderId: true,
          body: true,
          fileUrls: true,
          createdAt: true,
          sender: { select: { username: true, firstName: true } },
        },
      },
      _count: { select: { messages: true } },
    },
  });
  if (!convo) throw Errors.notFound("Conversation not found");

  // Access record FIRST, written directly (NOT via the failure-swallowing audit()
  // wrapper): this read is only permitted BECAUSE it is logged, so a failed audit
  // write must abort the read — a transcript is never returned without a trace.
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "admin.conversation.read",
      entity: "Conversation",
      entityId: conversationId,
      metadata: { messageCount: convo._count.messages },
    },
  });

  return {
    id: convo.id,
    buyer: convo.buyer ?? convo.order?.buyer ?? null,
    seller: convo.seller ?? convo.order?.seller ?? null,
    gigTitle: convo.gig?.title ?? convo.order?.gig?.title ?? null,
    order: convo.order
      ? { id: convo.order.id, status: convo.order.status, amountUzs: convo.order.amountUzs }
      : null,
    totalMessages: convo._count.messages,
    // Stored newest-first for the cap; render oldest-first.
    messages: convo.messages.slice().reverse(),
    createdAt: convo.createdAt,
  };
}

export interface PairStat {
  buyer: { id: string; username: string | null; firstName: string | null; email: string | null } | null;
  seller: { id: string; username: string | null; firstName: string | null; email: string | null } | null;
  orders: number;
  paidUzs: number;
  completed: number;
  disputed: number;
}

/** Top buyer↔seller pairs by paid volume — the platform's strongest relationships. */
export async function getPairStats(limit = 15): Promise<PairStat[]> {
  const groups = await prisma.order.groupBy({
    by: ["buyerId", "sellerId"],
    where: { status: { in: [...PAID_STATUSES] } },
    _count: true,
    _sum: { amountUzs: true },
    orderBy: { _sum: { amountUzs: "desc" } },
    take: limit,
  });
  if (groups.length === 0) return [];

  const ids = [...new Set(groups.flatMap((g) => [g.buyerId, g.sellerId]))];
  const [users, byStatus] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, ...userBrief }),
    prisma.order.groupBy({
      by: ["buyerId", "sellerId", "status"],
      where: {
        status: { in: ["COMPLETED", "DISPUTED"] },
        OR: groups.map((g) => ({ buyerId: g.buyerId, sellerId: g.sellerId })),
      },
      _count: true,
    }),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const statusCount = (buyerId: string, sellerId: string, status: string) =>
    byStatus.find((s) => s.buyerId === buyerId && s.sellerId === sellerId && s.status === status)?._count ?? 0;

  return groups.map((g) => ({
    buyer: userMap.get(g.buyerId) ?? null,
    seller: userMap.get(g.sellerId) ?? null,
    orders: g._count,
    paidUzs: g._sum.amountUzs ?? 0,
    completed: statusCount(g.buyerId, g.sellerId, "COMPLETED"),
    disputed: statusCount(g.buyerId, g.sellerId, "DISPUTED"),
  }));
}

export interface CategoryStat {
  id: string;
  nameEn: string;
  nameUz: string;
  nameRu: string;
  activeGigs: number;
  paidOrders: number;
  paidUzs: number;
  completedUzs: number;
}

/** Orders/GMV per category (uncategorized gigs roll into an "(uncategorized)" row). */
export async function getCategoryStats(): Promise<CategoryStat[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string | null;
      nameEn: string | null;
      nameUz: string | null;
      nameRu: string | null;
      activeGigs: bigint;
      paidOrders: bigint;
      paidUzs: bigint | null;
      completedUzs: bigint | null;
    }>
  >(Prisma.sql`
    SELECT
      c."id",
      c."nameEn",
      c."nameUz",
      c."nameRu",
      (SELECT COUNT(*) FROM "Gig" g2
        WHERE g2."categoryId" IS NOT DISTINCT FROM c."id"
          AND g2."status" = 'ACTIVE' AND g2."deletedAt" IS NULL) AS "activeGigs",
      COUNT(o."id") FILTER (WHERE o."status"::text IN (${Prisma.join([...PAID_STATUSES])})) AS "paidOrders",
      SUM(o."amountUzs") FILTER (WHERE o."status"::text IN (${Prisma.join([...PAID_STATUSES])})) AS "paidUzs",
      SUM(o."amountUzs") FILTER (WHERE o."status"::text = 'COMPLETED') AS "completedUzs"
    FROM "Category" c
    LEFT JOIN "Gig" g ON g."categoryId" = c."id"
    LEFT JOIN "Order" o ON o."gigId" = g."id"
    GROUP BY c."id", c."nameEn", c."nameUz", c."nameRu"

    UNION ALL

    SELECT
      NULL, NULL, NULL, NULL,
      (SELECT COUNT(*) FROM "Gig" g2
        WHERE g2."categoryId" IS NULL AND g2."status" = 'ACTIVE' AND g2."deletedAt" IS NULL),
      COUNT(o."id") FILTER (WHERE o."status"::text IN (${Prisma.join([...PAID_STATUSES])})),
      SUM(o."amountUzs") FILTER (WHERE o."status"::text IN (${Prisma.join([...PAID_STATUSES])})),
      SUM(o."amountUzs") FILTER (WHERE o."status"::text = 'COMPLETED')
    FROM "Gig" g
    LEFT JOIN "Order" o ON o."gigId" = g."id"
    WHERE g."categoryId" IS NULL
  `);

  return rows
    .map((r) => ({
      id: r.id ?? "uncategorized",
      nameEn: r.nameEn ?? "(uncategorized)",
      nameUz: r.nameUz ?? "(kategoriyasiz)",
      nameRu: r.nameRu ?? "(без категории)",
      activeGigs: Number(r.activeGigs),
      paidOrders: Number(r.paidOrders),
      paidUzs: Number(r.paidUzs ?? 0),
      completedUzs: Number(r.completedUzs ?? 0),
    }))
    .filter((r) => r.activeGigs > 0 || r.paidOrders > 0)
    .sort((a, b) => b.paidUzs - a.paidUzs || b.activeGigs - a.activeGigs);
}
