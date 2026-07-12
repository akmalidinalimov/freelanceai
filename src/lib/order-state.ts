import type { OrderStatus } from "@prisma/client";

/**
 * Order state machine. Pure (no server-only / db) so it's unit-testable.
 * Payments will add PENDING_PAYMENT→PAID→IN_PROGRESS ahead of the work phase.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["DELIVERED", "CANCELLED", "DISPUTED"],
  DELIVERED: ["COMPLETED", "REVISION", "DISPUTED"],
  REVISION: ["DELIVERED", "CANCELLED", "DISPUTED"],
  COMPLETED: [],
  CANCELLED: [],
  // Admin resolves a dispute by refunding (→CANCELLED) or releasing (→COMPLETED).
  DISPUTED: ["CANCELLED", "COMPLETED"],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}
