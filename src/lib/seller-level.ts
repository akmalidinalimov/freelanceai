import type { SellerLevel } from "@prisma/client";

/**
 * Seller level from completed orders + rating. Pure → unit-tested. Job-computed, never
 * client-set. Thresholds are deliberately conservative for a new marketplace.
 */
export function computeSellerLevel(
  completedOrders: number,
  ratingAvg: number,
  ratingCount: number
): SellerLevel {
  if (completedOrders >= 50 && ratingCount >= 30 && ratingAvg >= 4.8) return "TOP_RATED";
  if (completedOrders >= 10 && ratingCount >= 5 && ratingAvg >= 4.5) return "LEVEL_2";
  if (completedOrders >= 2 && ratingAvg >= 4.0) return "LEVEL_1";
  return "NEW";
}
