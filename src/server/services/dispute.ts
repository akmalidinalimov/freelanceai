import "server-only";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";
import { canTransition } from "@/lib/order-state";
import { reversalPostings } from "@/lib/commission";
import { restoreOrderCredit } from "@/server/services/affiliate";
import { recomputeSellerStats } from "@/server/services/profile";
import { notifyAndPush, notifyAdmins } from "@/server/services/notification";

const NAME = { select: { firstName: true, name: true, username: true } } as const;

/** Buyer or seller opens a dispute on an active order → order DISPUTED. */
export async function openDispute(orderId: string, user: User, reason: string) {
  const text = reason.trim();
  if (text.length < 5) throw Errors.validation({ reason: "Please describe the issue" });
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Errors.notFound("Order not found");
  if (order.buyerId !== user.id && order.sellerId !== user.id && user.role !== "ADMIN") {
    throw Errors.forbidden();
  }
  if (!canTransition(order.status, "DISPUTED")) {
    throw Errors.conflict(`Cannot dispute an order in ${order.status}`);
  }
  await prisma.$transaction([
    prisma.dispute.create({ data: { orderId, openedById: user.id, reason: text } }),
    prisma.order.update({ where: { id: orderId }, data: { status: "DISPUTED" } }),
  ]);
  await audit({ actorId: user.id, action: "dispute.open", entity: "Order", entityId: orderId });
  const otherId = user.id === order.buyerId ? order.sellerId : order.buyerId;
  await notifyAndPush(otherId, "dispute.opened", "Nizo ochildi", {
    body: "Buyurtma boʻyicha nizo ochildi — administrator koʻrib chiqadi.",
    link: `/orders/${orderId}`,
  });
  await notifyAdmins("admin.dispute", "⚠️ Yangi nizo ochildi", {
    body: "Buyurtma boʻyicha nizo — koʻrib chiqing.",
    link: "/admin/disputes",
  });
}

export function listOpenDisputes() {
  return prisma.dispute.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    include: {
      order: { include: { gig: { select: { title: true } }, buyer: NAME, seller: NAME } },
    },
  });
}

/** Admin resolves a dispute: refund (reverse ledger, order CANCELLED) or release (order COMPLETED). */
export async function resolveDispute(
  disputeId: string,
  admin: User,
  resolution: "refund" | "release",
  note?: string
) {
  if (admin.role !== "ADMIN") throw Errors.forbidden("Admins only");
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId }, include: { order: true } });
  if (!dispute) throw Errors.notFound("Dispute not found");
  if (dispute.status !== "OPEN") throw Errors.conflict("Dispute already resolved");
  const order = dispute.order;

  if (resolution === "refund") {
    if (!canTransition(order.status, "CANCELLED")) throw Errors.conflict("Cannot refund this order");
    const idem = `order:${order.id}:refund`;
    await prisma.$transaction(async (tx) => {
      // Claim the dispute AND the order atomically first — a concurrent resolve (refund vs
      // release) can otherwise both post, leaving the buyer refunded AND the seller payable.
      const claimedDispute = await tx.dispute.updateMany({
        where: { id: disputeId, status: "OPEN" },
        data: { status: "RESOLVED_REFUND", resolution: note?.trim() || null },
      });
      if (claimedDispute.count === 0) throw Errors.conflict("Dispute already resolved");
      const claimedOrder = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: "CANCELLED" },
      });
      if (claimedOrder.count === 0) throw Errors.conflict("Order status changed");
      const existing = await tx.transaction.findUnique({ where: { idempotencyKey: idem } });
      if (!existing) {
        await tx.transaction.create({
          data: {
            orderId: order.id,
            provider: "MANUAL",
            type: "REFUND",
            status: "SUCCEEDED",
            amountUzs: order.amountUzs - order.discountUzs,
            idempotencyKey: idem,
          },
        });
        await tx.ledgerEntry.createMany({
          data: reversalPostings(order.amountUzs, order.commissionUzs, order.discountUzs).map((p) => ({
            orderId: order.id,
            account: p.account,
            amountUzs: p.amountUzs,
            userId: p.account === "SELLER_PAYABLE" ? order.sellerId : null,
            memo: `Refund for order ${order.id}`,
          })),
        });
        // Give the buyer back any credit they spent on this (now refunded) order.
        await restoreOrderCredit(tx, order);
      }
    });
  } else {
    if (!canTransition(order.status, "COMPLETED")) throw Errors.conflict("Cannot release this order");
    await prisma.$transaction(async (tx) => {
      const claimedDispute = await tx.dispute.updateMany({
        where: { id: disputeId, status: "OPEN" },
        data: { status: "RESOLVED_RELEASE", resolution: note?.trim() || null },
      });
      if (claimedDispute.count === 0) throw Errors.conflict("Dispute already resolved");
      const claimedOrder = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      if (claimedOrder.count === 0) throw Errors.conflict("Order status changed");
    });
    // Release completes the order → keep the seller's public stats fresh (parity with
    // acceptOrder; auto-complete/dispute previously skipped this).
    await recomputeSellerStats(order.sellerId);
  }
  await audit({ actorId: admin.id, action: `dispute.${resolution}`, entity: "Dispute", entityId: disputeId });
}
