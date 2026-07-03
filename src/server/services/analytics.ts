import "server-only";
import { prisma } from "@/lib/prisma";

export interface SellerStats {
  totalOrders: number;
  completed: number;
  active: number; // in-progress-ish
  activeGigs: number;
  views: number;
  conversionPct: number; // completed orders / gig views
  byStatus: Record<string, number>;
  /** Momentum: last-30-days slice (new orders, completions, net revenue, new contacts). */
  last30: { orders: number; completed: number; revenueUzs: number; contacts: number };
}

/** Read-only seller performance metrics for the dashboard. */
export async function getSellerStats(sellerId: string): Promise<SellerStats> {
  const d30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [statusGroups, viewAgg, activeGigs, orders30, completed30Agg, contacts30] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], where: { sellerId }, _count: true }),
    prisma.gig.aggregate({ where: { sellerId, deletedAt: null }, _sum: { views: true } }),
    prisma.gig.count({ where: { sellerId, deletedAt: null, status: "ACTIVE" } }),
    prisma.order.count({ where: { sellerId, createdAt: { gte: d30 } } }),
    prisma.order.aggregate({
      where: { sellerId, status: "COMPLETED", updatedAt: { gte: d30 } },
      _sum: { sellerNetUzs: true },
      _count: true,
    }),
    prisma.conversation.count({ where: { sellerId, createdAt: { gte: d30 } } }),
  ]);

  const byStatus: Record<string, number> = {};
  let totalOrders = 0;
  for (const g of statusGroups) {
    byStatus[g.status] = g._count;
    totalOrders += g._count;
  }
  const completed = byStatus.COMPLETED ?? 0;
  const active = (byStatus.IN_PROGRESS ?? 0) + (byStatus.DELIVERED ?? 0) + (byStatus.REVISION ?? 0);
  const views = viewAgg._sum.views ?? 0;
  const conversionPct = views > 0 ? Math.round((completed / views) * 1000) / 10 : 0;

  return {
    totalOrders,
    completed,
    active,
    activeGigs,
    views,
    conversionPct,
    byStatus,
    last30: {
      orders: orders30,
      completed: completed30Agg._count,
      revenueUzs: completed30Agg._sum.sellerNetUzs ?? 0,
      contacts: contacts30,
    },
  };
}

export interface BuyerStats {
  ordersTotal: number;
  ordersActive: number;
  ordersCompleted: number;
  spentUzs: number; // succeeded payments across their orders
  refundedUzs: number; // succeeded refunds back to the buyer
  refundedCount: number;
  sellersContacted: number;
  savedGigs: number;
  reviewsWritten: number;
}

/** Read-only buyer activity metrics for the buyer dashboard. */
export async function getBuyerStats(buyerId: string): Promise<BuyerStats> {
  const [byStatus, paidAgg, refundAgg, contacts, saved, reviews] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], where: { buyerId }, _count: true }),
    prisma.transaction.aggregate({
      where: { type: "PAYMENT_IN", status: "SUCCEEDED", order: { buyerId } },
      _sum: { amountUzs: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "REFUND", status: "SUCCEEDED", order: { buyerId } },
      _sum: { amountUzs: true },
      _count: true,
    }),
    prisma.conversation.count({ where: { buyerId } }),
    prisma.savedGig.count({ where: { userId: buyerId } }),
    prisma.review.count({ where: { authorId: buyerId } }),
  ]);
  const m: Record<string, number> = Object.fromEntries(byStatus.map((g) => [g.status, g._count]));
  const ordersTotal = byStatus.reduce((a, g) => a + g._count, 0);
  const ordersActive =
    (m.PENDING_PAYMENT ?? 0) + (m.IN_PROGRESS ?? 0) + (m.DELIVERED ?? 0) + (m.REVISION ?? 0) + (m.DISPUTED ?? 0);
  return {
    ordersTotal,
    ordersActive,
    ordersCompleted: m.COMPLETED ?? 0,
    spentUzs: paidAgg._sum.amountUzs ?? 0,
    refundedUzs: refundAgg._sum.amountUzs ?? 0,
    refundedCount: refundAgg._count,
    sellersContacted: contacts,
    savedGigs: saved,
    reviewsWritten: reviews,
  };
}

export interface AdminStats {
  gmvUzs: number; // gross merchandise value (completed orders)
  platformRevenueUzs: number; // commission earned (net of discounts/refunds)
  totalOrders: number;
  byStatus: Record<string, number>;
  users: number;
  sellers: number;
  gigsActive: number;
  ledgerOrders: number; // orders that have ledger entries
  ledgerImbalanced: number; // orders whose entries don't net to zero (should be 0)
}

export interface AdminActivityStats {
  /** Active users (lastSeenAt within N days) for 3/7/14/30-day windows. */
  activeUsers: { d3: number; d7: number; d14: number; d30: number };
  /** New registrations for 1/7/30-day windows. */
  registrations: { d1: number; d7: number; d30: number };
  /** Conversations started + messages sent, 7/30-day windows. */
  contacts: { d7: number; d30: number };
  messages: { d7: number; d30: number };
  /** Funnel: CTA clicks vs real conversions (server-written), 30-day window. */
  funnel: {
    orderCtaClicks: number;
    ordersCreated: number;
    ordersPaid: number;
    contactCtaClicks: number;
    conversationsStarted: number;
  };
  /** Ever-chatted-with-the-Telegram-bot count + KYC-verified count. */
  telegramLinked: number;
  kycVerified: number;
}

/** Activity/engagement metrics (admin dashboard). Separate from finance stats so the
 * ledger scan doesn't slow the fast tiles. */
export async function getAdminActivityStats(): Promise<AdminActivityStats> {
  const now = Date.now();
  const ago = (days: number) => new Date(now - days * 24 * 3600 * 1000);
  const activeSince = (d: Date) => prisma.user.count({ where: { lastSeenAt: { gte: d }, status: "ACTIVE" } });
  const regSince = (d: Date) => prisma.user.count({ where: { createdAt: { gte: d } } });
  const convSince = (d: Date) => prisma.conversation.count({ where: { createdAt: { gte: d } } });
  const msgSince = (d: Date) => prisma.message.count({ where: { createdAt: { gte: d } } });
  const events = (type: string, d: Date) =>
    prisma.activityEvent.count({ where: { type, createdAt: { gte: d } } });

  const d30 = ago(30);
  const [a3, a7, a14, a30, r1, r7, r30, c7, c30, m7, m30, ctaOrder, created, paid, ctaContact, tg, kyc] =
    await Promise.all([
      activeSince(ago(3)),
      activeSince(ago(7)),
      activeSince(ago(14)),
      activeSince(d30),
      regSince(ago(1)),
      regSince(ago(7)),
      regSince(d30),
      convSince(ago(7)),
      convSince(d30),
      msgSince(ago(7)),
      msgSince(d30),
      events("order_cta_click", d30),
      events("order_created", d30),
      events("order_paid", d30),
      events("contact_cta_click", d30),
      prisma.user.count({ where: { telegramLastChatAt: { not: null } } }),
      prisma.user.count({ where: { kycStatus: "VERIFIED" } }),
    ]);

  return {
    activeUsers: { d3: a3, d7: a7, d14: a14, d30: a30 },
    registrations: { d1: r1, d7: r7, d30: r30 },
    contacts: { d7: c7, d30: c30 },
    messages: { d7: m7, d30: m30 },
    funnel: {
      orderCtaClicks: ctaOrder,
      ordersCreated: created,
      ordersPaid: paid,
      contactCtaClicks: ctaContact,
      conversationsStarted: c30,
    },
    telegramLinked: tg,
    kycVerified: kyc,
  };
}

/** Read-only platform finance + ops metrics for the admin dashboard. */
export async function getAdminStats(): Promise<AdminStats> {
  const [statusGroups, gmvAgg, revenueAgg, users, sellers, gigsActive, ledgerByOrder] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], _count: true }),
    prisma.order.aggregate({ where: { status: "COMPLETED" }, _sum: { amountUzs: true } }),
    prisma.ledgerEntry.aggregate({ where: { account: "PLATFORM_REVENUE" }, _sum: { amountUzs: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { isSeller: true } }),
    prisma.gig.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.ledgerEntry.groupBy({ by: ["orderId"], _sum: { amountUzs: true } }),
  ]);

  const byStatus: Record<string, number> = {};
  let totalOrders = 0;
  for (const g of statusGroups) {
    byStatus[g.status] = g._count;
    totalOrders += g._count;
  }
  // PLATFORM_REVENUE is stored as a negative credit; flip the sign for display.
  const platformRevenueUzs = -(revenueAgg._sum.amountUzs ?? 0);
  // Every transaction is internally balanced, so each order's entries must net to zero.
  const ledgerImbalanced = ledgerByOrder.filter((g) => (g._sum.amountUzs ?? 0) !== 0).length;

  return {
    gmvUzs: gmvAgg._sum.amountUzs ?? 0,
    platformRevenueUzs,
    totalOrders,
    byStatus,
    users,
    sellers,
    gigsActive,
    ledgerOrders: ledgerByOrder.length,
    ledgerImbalanced,
  };
}

/** Counts of the four admin action queues — for the bot's /pending command. */
export async function getAdminPendingCounts(): Promise<{
  gigs: number;
  kyc: number;
  disputes: number;
  payouts: number;
}> {
  const [gigs, kyc, disputes, payouts] = await Promise.all([
    prisma.gig.count({ where: { status: "PENDING_REVIEW", deletedAt: null } }),
    prisma.user.count({ where: { kycStatus: "PENDING" } }),
    prisma.dispute.count({ where: { status: "OPEN" } }),
    prisma.payoutRequest.count({ where: { status: "REQUESTED" } }),
  ]);
  return { gigs, kyc, disputes, payouts };
}

export interface AdminInfographics {
  users: number;
  sellers: number;
  buyers: number;
  activeGigs: number;
  totalOrders: number;
  completedOrders: number;
  gmvUzs: number;
  platformRevenueUzs: number;
  signups: { d1: number; d3: number; d7: number; d30: number };
  dailySignups: { day: string; n: number }[];
  dailyOrders: { day: string; n: number }[];
  dailyRevenue: { day: string; n: number }[];
  byStatus: Record<string, number>;
}

/** Gap-fill grouped rows into a contiguous 14-day series (oldest → newest). */
function fillDays(rows: { day: Date; n: bigint | number }[]): { day: string; n: number }[] {
  const map = new Map(rows.map((r) => [new Date(r.day).toISOString().slice(0, 10), Number(r.n)]));
  const out: { day: string; n: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const key = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ day: key, n: map.get(key) ?? 0 });
  }
  return out;
}

/** Daily signup/order COUNTS over the last 14 days. */
async function dailySeries(table: "User" | "Order", since: Date): Promise<{ day: string; n: number }[]> {
  // Table name can't be parameterized, so branch on two literal queries (no injection);
  // the date bound IS parameterized. count(*)::int keeps it a JS number, not bigint.
  const rows =
    table === "User"
      ? await prisma.$queryRaw<{ day: Date; n: number }[]>`
          SELECT date_trunc('day', "createdAt") AS day, count(*)::int AS n
          FROM "User" WHERE "createdAt" >= ${since} GROUP BY 1`
      : await prisma.$queryRaw<{ day: Date; n: number }[]>`
          SELECT date_trunc('day', "createdAt") AS day, count(*)::int AS n
          FROM "Order" WHERE "createdAt" >= ${since} GROUP BY 1`;
  return fillDays(rows);
}

/** Daily realized revenue (sum of COMPLETED order value by completion day), UZS. */
async function dailyRevenueSeries(since: Date): Promise<{ day: string; n: number }[]> {
  const rows = await prisma.$queryRaw<{ day: Date; n: bigint }[]>`
    SELECT date_trunc('day', "completedAt") AS day, COALESCE(sum("amountUzs"), 0)::bigint AS n
    FROM "Order" WHERE status = 'COMPLETED' AND "completedAt" >= ${since} GROUP BY 1`;
  return fillDays(rows);
}

/** Everything the admin infographic dashboard (and the bot's Stats button) needs. */
export async function getAdminInfographics(): Promise<AdminInfographics> {
  const now = Date.now();
  const ago = (d: number) => new Date(now - d * 86_400_000);
  const [core, d1, d3, d7, d30, dailySignups, dailyOrders, dailyRevenue] = await Promise.all([
    getAdminStats(),
    prisma.user.count({ where: { createdAt: { gte: ago(1) } } }),
    prisma.user.count({ where: { createdAt: { gte: ago(3) } } }),
    prisma.user.count({ where: { createdAt: { gte: ago(7) } } }),
    prisma.user.count({ where: { createdAt: { gte: ago(30) } } }),
    dailySeries("User", ago(14)).catch(() => []),
    dailySeries("Order", ago(14)).catch(() => []),
    dailyRevenueSeries(ago(14)).catch(() => []),
  ]);
  return {
    users: core.users,
    sellers: core.sellers,
    buyers: Math.max(0, core.users - core.sellers),
    activeGigs: core.gigsActive,
    totalOrders: core.totalOrders,
    completedOrders: core.byStatus["COMPLETED"] ?? 0,
    gmvUzs: core.gmvUzs,
    platformRevenueUzs: core.platformRevenueUzs,
    signups: { d1, d3, d7, d30 },
    dailySignups,
    dailyOrders,
    dailyRevenue,
    byStatus: core.byStatus,
  };
}
