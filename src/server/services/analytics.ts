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
