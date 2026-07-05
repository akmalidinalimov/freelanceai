import "server-only";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";
import { canTransition } from "@/lib/order-state";
import { reversalPostings } from "@/lib/commission";
import { restoreOrderCredit } from "@/server/services/affiliate";
import { notifyAndPush } from "@/server/services/notification";

/** A party requests a mutual cancellation of an active order. */
export async function requestCancellation(orderId: string, user: User, reason: string) {
  const text = reason.trim();
  if (text.length < 5) throw Errors.validation({ reason: "Please describe why" });
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Errors.notFound("Order not found");
  if (order.buyerId !== user.id && order.sellerId !== user.id && user.role !== "ADMIN") {
    throw Errors.forbidden();
  }
  if (!canTransition(order.status, "CANCELLED")) throw Errors.conflict("This order can't be cancelled now");
  const existing = await prisma.cancellationRequest.findUnique({ where: { orderId } });
  if (existing?.status === "PENDING") throw Errors.conflict("A cancellation request is already pending");

  await prisma.cancellationRequest.upsert({
    where: { orderId },
    create: { orderId, requestedById: user.id, reason: text, status: "PENDING" },
    update: { requestedById: user.id, reason: text, status: "PENDING" },
  });
  await audit({ actorId: user.id, action: "cancellation.request", entity: "Order", entityId: orderId });
  const otherId = user.id === order.buyerId ? order.sellerId : order.buyerId;
  await notifyAndPush(otherId, "cancellation.requested", "Bekor qilish soʻrovi", {
    body: "Buyurtmani bekor qilish soʻraldi — tasdiqlang yoki rad eting.",
    link: `/orders/${orderId}`,
  });
}

/** The OTHER party (or an admin) approves or declines a pending cancellation request. */
export async function respondCancellation(orderId: string, user: User, approve: boolean) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Errors.notFound("Order not found");
  const req = await prisma.cancellationRequest.findUnique({ where: { orderId } });
  if (!req || req.status !== "PENDING") throw Errors.conflict("No pending cancellation request");
  const isParty = user.id === order.buyerId || user.id === order.sellerId;
  if ((!isParty && user.role !== "ADMIN") || user.id === req.requestedById) throw Errors.forbidden();

  if (!approve) {
    await prisma.cancellationRequest.update({ where: { orderId }, data: { status: "DECLINED" } });
    await audit({ actorId: user.id, action: "cancellation.decline", entity: "Order", entityId: orderId });
    await notifyAndPush(req.requestedById, "cancellation.declined", "Bekor qilish rad etildi", {
      link: `/orders/${orderId}`,
    });
    return;
  }

  if (!canTransition(order.status, "CANCELLED")) throw Errors.conflict("This order can't be cancelled now");
  const idem = `order:${orderId}:cancel-refund`;
  await prisma.$transaction(async (tx) => {
    // Reverse the confirmed payment (discount-aware), idempotently.
    const paid = await tx.transaction.findFirst({
      where: { orderId, type: "PAYMENT_IN", status: "SUCCEEDED" },
    });
    const already = await tx.transaction.findUnique({ where: { idempotencyKey: idem } });
    if (paid && !already) {
      await tx.transaction.create({
        data: {
          orderId,
          provider: "MANUAL",
          type: "REFUND",
          status: "SUCCEEDED",
          amountUzs: order.amountUzs - order.discountUzs,
          idempotencyKey: idem,
        },
      });
      await tx.ledgerEntry.createMany({
        data: reversalPostings(order.amountUzs, order.commissionUzs, order.discountUzs).map((p) => ({
          orderId,
          account: p.account,
          amountUzs: p.amountUzs,
          userId: p.account === "SELLER_PAYABLE" ? order.sellerId : null,
          memo: `Cancellation refund for order ${orderId}`,
        })),
      });
    }
    // Return any referral credit reserved on this order — whether it was paid (refunded above)
    // or still unpaid (credit was reserved at checkout). Idempotent, so it can't double-credit.
    await restoreOrderCredit(tx, order);
    await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
    await tx.cancellationRequest.update({ where: { orderId }, data: { status: "APPROVED" } });
  });
  await audit({ actorId: user.id, action: "cancellation.approve", entity: "Order", entityId: orderId });
  await notifyAndPush(req.requestedById, "cancellation.approved", "Buyurtma bekor qilindi", {
    link: `/orders/${orderId}`,
  });
}

export function getOrderCancellation(orderId: string) {
  return prisma.cancellationRequest.findUnique({ where: { orderId } });
}
