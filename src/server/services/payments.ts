import "server-only";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";
import { paymentPostings, payoutPostings, tipPostings } from "@/lib/commission";
import { notify } from "@/server/services/notification";

const NAME_SELECT = { select: { firstName: true, name: true, username: true } } as const;

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
  await notify(order.sellerId, "order.paid", "Toʻlov tasdiqlandi", {
    body: "Buyurtma toʻlovi tasdiqlandi — ishni boshlang.",
    link: `/orders/${orderId}`,
  });
}

/** Total successful tips received by a seller (across all their orders). */
async function sellerTipsTotal(sellerId: string): Promise<number> {
  const tips = await prisma.transaction.findMany({
    where: { type: "TIP", status: "SUCCEEDED", order: { sellerId } },
    select: { amountUzs: true },
  });
  return tips.reduce((a, t) => a + t.amountUzs, 0);
}

/** Buyer tips the seller on a COMPLETED order — fully credited to the seller (no commission). */
export async function tipOrder(orderId: string, buyer: User, amountUzs: number) {
  if (!Number.isInteger(amountUzs) || amountUzs < 1000 || amountUzs > 10_000_000) {
    throw Errors.validation({ amountUzs: "Invalid tip amount" });
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Errors.notFound("Order not found");
  if (order.buyerId !== buyer.id) throw Errors.forbidden();
  if (order.status !== "COMPLETED") throw Errors.conflict("You can tip only after completion");

  await prisma.$transaction(async (tx) => {
    await tx.transaction.create({
      data: { orderId, provider: "MANUAL", type: "TIP", status: "SUCCEEDED", amountUzs },
    });
    await tx.ledgerEntry.createMany({
      data: tipPostings(amountUzs).map((p) => ({
        orderId,
        account: p.account,
        amountUzs: p.amountUzs,
        userId: p.account === "SELLER_PAYABLE" ? order.sellerId : null,
        memo: `Tip for order ${orderId}`,
      })),
    });
  });
  await audit({ actorId: buyer.id, action: "order.tip", entity: "Order", entityId: orderId });
  await notify(order.sellerId, "order.tip", "Choychaqa oldingiz", {
    body: "Buyurtmachi sizga choychaqa qoldirdi.",
    link: `/orders/${orderId}`,
  });
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

  const [paidOut, tips] = await Promise.all([
    prisma.payoutRequest.aggregate({ where: { sellerId, status: "PAID" }, _sum: { amountUzs: true } }),
    sellerTipsTotal(sellerId),
  ]);

  const lifetimeWithTips = lifetimeUzs + tips;
  return {
    heldUzs,
    lifetimeUzs: lifetimeWithTips,
    availableUzs: lifetimeWithTips - (paidOut._sum.amountUzs ?? 0),
  };
}

function displayName(u: { firstName: string | null; name: string | null; username: string | null } | null) {
  return u?.firstName ?? u?.name ?? u?.username ?? "";
}

/** Orders awaiting (manual) payment confirmation — for the admin console. */
export async function listPendingPayments() {
  const orders = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT" },
    orderBy: { createdAt: "asc" },
    include: { gig: { select: { title: true } }, buyer: NAME_SELECT, seller: NAME_SELECT },
  });
  return orders.map((o) => ({
    id: o.id,
    gigTitle: o.gig.title,
    buyer: displayName(o.buyer),
    seller: displayName(o.seller),
    amountUzs: o.amountUzs,
  }));
}

export interface SellerBalanceRow {
  sellerId: string;
  name: string;
  lifetimeUzs: number;
  paidUzs: number;
  availableUzs: number;
}

/** Sellers with a positive withdrawable balance (completed earnings minus payouts). */
export async function listSellerBalances(): Promise<SellerBalanceRow[]> {
  const [completed, payouts, tipTxns] = await Promise.all([
    prisma.order.groupBy({ by: ["sellerId"], where: { status: "COMPLETED" }, _sum: { sellerNetUzs: true } }),
    prisma.payoutRequest.groupBy({ by: ["sellerId"], where: { status: "PAID" }, _sum: { amountUzs: true } }),
    prisma.transaction.findMany({
      where: { type: "TIP", status: "SUCCEEDED" },
      select: { amountUzs: true, order: { select: { sellerId: true } } },
    }),
  ]);
  const paidMap = new Map(payouts.map((p) => [p.sellerId, p._sum.amountUzs ?? 0]));
  const tipMap = new Map<string, number>();
  for (const t of tipTxns) {
    if (t.order) tipMap.set(t.order.sellerId, (tipMap.get(t.order.sellerId) ?? 0) + t.amountUzs);
  }

  const rows = completed
    .map((c) => {
      const lifetimeUzs = (c._sum.sellerNetUzs ?? 0) + (tipMap.get(c.sellerId) ?? 0);
      const paidUzs = paidMap.get(c.sellerId) ?? 0;
      return { sellerId: c.sellerId, lifetimeUzs, paidUzs, availableUzs: lifetimeUzs - paidUzs };
    })
    .filter((r) => r.availableUzs > 0);

  const sellers = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.sellerId) } },
    select: { id: true, firstName: true, name: true, username: true },
  });
  const nameMap = new Map(sellers.map((s) => [s.id, displayName(s)]));
  return rows.map((r) => ({ ...r, name: nameMap.get(r.sellerId) ?? r.sellerId }));
}

/** Record a (manual) payout to a seller: PayoutRequest PAID + balanced ledger postings. */
export async function recordPayout(
  admin: User,
  sellerId: string,
  amountUzs: number,
  cardMasked: string,
  note?: string
) {
  if (admin.role !== "ADMIN") throw Errors.forbidden("Only an admin can record payouts");
  if (!Number.isInteger(amountUzs) || amountUzs <= 0) throw Errors.validation({ amountUzs: "Invalid amount" });
  if (!cardMasked || cardMasked.trim().length < 4) throw Errors.validation({ cardMasked: "Card is required" });

  const [completed, payouts] = await Promise.all([
    prisma.order.aggregate({ where: { sellerId, status: "COMPLETED" }, _sum: { sellerNetUzs: true } }),
    prisma.payoutRequest.aggregate({ where: { sellerId, status: "PAID" }, _sum: { amountUzs: true } }),
  ]);
  const available = (completed._sum.sellerNetUzs ?? 0) - (payouts._sum.amountUzs ?? 0);
  if (amountUzs > available) throw Errors.conflict(`Amount exceeds available balance (${available})`);

  await prisma.$transaction(async (tx) => {
    await tx.payoutRequest.create({
      data: {
        sellerId,
        amountUzs,
        cardMasked: cardMasked.trim(),
        status: "PAID",
        processedBy: admin.id,
        note: note?.trim() || null,
      },
    });
    await tx.ledgerEntry.createMany({
      data: payoutPostings(amountUzs).map((p) => ({
        account: p.account,
        amountUzs: p.amountUzs,
        userId: sellerId,
        memo: `Payout to seller ${sellerId}`,
      })),
    });
  });

  await audit({ actorId: admin.id, action: "payout.record", entity: "PayoutRequest", entityId: sellerId });
}

export async function listRecentPayouts(take = 20) {
  const payouts = await prisma.payoutRequest.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { seller: NAME_SELECT },
  });
  return payouts.map((p) => ({
    id: p.id,
    seller: displayName(p.seller),
    amountUzs: p.amountUzs,
    cardMasked: p.cardMasked,
    createdAt: p.createdAt.toISOString(),
  }));
}
