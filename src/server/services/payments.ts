import "server-only";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";
import { paymentPostings } from "@/lib/commission";

/**
 * Confirm that payment was received for an order (manual/facilitator settlement,
 * admin-only). Posts the balanced double-entry ledger + a Transaction record and
 * moves the order into work (PENDING_PAYMENT → PAID → IN_PROGRESS). Idempotent via
 * the Transaction.idempotencyKey, so a double-click can't double-post the ledger.
 */
export async function confirmOrderPayment(orderId: string, actor: User) {
  if (actor.role !== "ADMIN") throw Errors.forbidden("Only an admin can confirm payment");

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Errors.notFound("Order not found");
  if (order.status !== "PENDING_PAYMENT") {
    throw Errors.conflict(`Order is not awaiting payment (status: ${order.status})`);
  }

  const idempotencyKey = `order:${orderId}:payment-in`;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUnique({ where: { idempotencyKey } });
    if (existing) return; // already settled — no double post

    await tx.transaction.create({
      data: {
        orderId,
        provider: "MANUAL",
        type: "PAYMENT_IN",
        status: "SUCCEEDED",
        amountUzs: order.amountUzs,
        idempotencyKey,
      },
    });

    await tx.ledgerEntry.createMany({
      data: paymentPostings(order.amountUzs, order.commissionUzs).map((p) => ({
        orderId,
        account: p.account,
        amountUzs: p.amountUzs,
        userId: p.account === "SELLER_PAYABLE" ? order.sellerId : null,
        memo: `Manual payment for order ${orderId}`,
      })),
    });

    await tx.order.update({ where: { id: orderId }, data: { status: "IN_PROGRESS" } });
  });

  await audit({ actorId: actor.id, action: "order.payment.confirm", entity: "Order", entityId: orderId });
}

export interface SellerEarnings {
  heldUzs: number; // in active orders, not yet releasable
  availableUzs: number; // completed and not yet paid out
  lifetimeUzs: number; // total net earned (completed)
}

/** Seller earnings derived from order status + payouts (ledger is the audit record). */
export async function getSellerEarnings(sellerId: string): Promise<SellerEarnings> {
  const orders = await prisma.order.findMany({
    where: { sellerId },
    select: { status: true, sellerNetUzs: true },
  });

  const ACTIVE = new Set(["PAID", "IN_PROGRESS", "DELIVERED", "REVISION"]);
  let heldUzs = 0;
  let lifetimeUzs = 0;
  for (const o of orders) {
    if (o.status === "COMPLETED") lifetimeUzs += o.sellerNetUzs;
    else if (ACTIVE.has(o.status)) heldUzs += o.sellerNetUzs;
  }

  const paidOut = await prisma.payoutRequest.aggregate({
    where: { sellerId, status: "PAID" },
    _sum: { amountUzs: true },
  });

  return {
    heldUzs,
    lifetimeUzs,
    availableUzs: lifetimeUzs - (paidOut._sum.amountUzs ?? 0),
  };
}
