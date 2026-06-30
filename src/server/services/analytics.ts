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
}

/** Read-only seller performance metrics for the dashboard. */
export async function getSellerStats(sellerId: string): Promise<SellerStats> {
  const [statusGroups, viewAgg, activeGigs] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], where: { sellerId }, _count: true }),
    prisma.gig.aggregate({ where: { sellerId, deletedAt: null }, _sum: { views: true } }),
    prisma.gig.count({ where: { sellerId, deletedAt: null, status: "ACTIVE" } }),
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

  return { totalOrders, completed, active, activeGigs, views, conversionPct, byStatus };
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
