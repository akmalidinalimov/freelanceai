import "server-only";
import { prisma } from "@/lib/prisma";
import type { User, $Enums, Prisma } from "@prisma/client";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";
import { paymentPostings, payoutPostings, tipPostings, discountedPaymentPostings } from "@/lib/commission";
import { notify } from "@/server/services/notification";

const NAME_SELECT = { select: { firstName: true, name: true, username: true } } as const;

type OrderRow = { id: string; sellerId: string; amountUzs: number; commissionUzs: number; discountUzs: number };

/**
 * Post a balanced payment-in settlement inside a transaction: a SUCCEEDED Transaction
 * (idempotency-keyed so a retry/double-click can't double-post), the double-entry
 * ledger, and the order moving PENDING_PAYMENT → IN_PROGRESS. Returns false if it was
 * already settled. Shared by the manual (admin) flow and the PSP webhooks.
 */
async function postOrderPaymentTx(
  tx: Prisma.TransactionClient,
  order: OrderRow,
  provider: $Enums.PaymentProvider,
  externalRef?: string
): Promise<boolean> {
  const idempotencyKey = `order:${order.id}:payment-in`;
  const existing = await tx.transaction.findUnique({ where: { idempotencyKey } });
  if (existing) return false; // already settled — no double post

  await tx.transaction.create({
    data: {
      orderId: order.id,
      provider,
      type: "PAYMENT_IN",
      status: "SUCCEEDED",
      // What the buyer actually pays (net of any platform-funded discount).
      amountUzs: order.amountUzs - order.discountUzs,
      idempotencyKey,
      rawPayload: externalRef ? { externalRef } : undefined,
    },
  });

  const postings =
    order.discountUzs > 0
      ? discountedPaymentPostings(order.amountUzs, order.commissionUzs, order.discountUzs)
      : paymentPostings(order.amountUzs, order.commissionUzs);
  await tx.ledgerEntry.createMany({
    data: postings.map((p) => ({
      orderId: order.id,
      account: p.account,
      amountUzs: p.amountUzs,
      userId: p.account === "SELLER_PAYABLE" ? order.sellerId : null,
      memo: `${provider} payment for order ${order.id}`,
    })),
  });

  await tx.order.update({ where: { id: order.id }, data: { status: "IN_PROGRESS" } });
  return true;
}

async function notifySellerPaid(orderId: string, sellerId: string) {
  await notify(sellerId, "order.paid", "Toʻlov tasdiqlandi", {
    body: "Buyurtma toʻlovi tasdiqlandi — ishni boshlang.",
    link: `/orders/${orderId}`,
  });
}

/**
 * Confirm that payment was received for an order (manual/facilitator settlement,
 * admin-only). Moves the order into work and posts the ledger via the shared path.
 */
export async function confirmOrderPayment(orderId: string, actor: User) {
  if (actor.role !== "ADMIN") throw Errors.forbidden("Only an admin can confirm payment");

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Errors.notFound("Order not found");
  if (order.status !== "PENDING_PAYMENT") {
    throw Errors.conflict(`Order is not awaiting payment (status: ${order.status})`);
  }

  let posted = false;
  await prisma.$transaction(async (tx) => {
    posted = await postOrderPaymentTx(tx, order, "MANUAL");
  });

  await audit({ actorId: actor.id, action: "order.payment.confirm", entity: "Order", entityId: orderId });
  if (posted) await notifySellerPaid(orderId, order.sellerId);
}

/**
 * Settle an order from a PSP webhook (Payme/Click) once the provider confirms the
 * payment. Idempotent: a no-op if the order is no longer awaiting payment or was
 * already settled. `externalRef` is the provider's transaction id (audit only).
 */
export async function settleOrderByProvider(
  orderId: string,
  provider: $Enums.PaymentProvider,
  externalRef?: string
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Errors.notFound("Order not found");
  if (order.status !== "PENDING_PAYMENT") return; // already settled / closed — idempotent

  let posted = false;
  await prisma.$transaction(async (tx) => {
    posted = await postOrderPaymentTx(tx, order, provider, externalRef);
  });

  if (posted) {
    await audit({
      actorId: order.sellerId,
      action: "order.payment.webhook",
      entity: "Order",
      entityId: orderId,
      metadata: { provider, externalRef: externalRef ?? null },
    });
    await notifySellerPaid(orderId, order.sellerId);
  }
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

/**
 * Single source of truth for a seller's withdrawable balance: completed net earnings + tips
 * − amounts already paid out. Every payout path (UI balance, request, admin fulfil) MUST use
 * this so the seller-facing balance and the payout ceiling can never disagree.
 */
export async function sellerAvailableUzs(sellerId: string): Promise<number> {
  const [completed, payouts, tips] = await Promise.all([
    prisma.order.aggregate({ where: { sellerId, status: "COMPLETED" }, _sum: { sellerNetUzs: true } }),
    prisma.payoutRequest.aggregate({ where: { sellerId, status: "PAID" }, _sum: { amountUzs: true } }),
    sellerTipsTotal(sellerId),
  ]);
  return (completed._sum.sellerNetUzs ?? 0) + tips - (payouts._sum.amountUzs ?? 0);
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
  payoutCardMasked: string | null;
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
    select: { id: true, firstName: true, name: true, username: true, payoutCardMasked: true },
  });
  const nameMap = new Map(sellers.map((s) => [s.id, displayName(s)]));
  const cardMap = new Map(sellers.map((s) => [s.id, s.payoutCardMasked]));
  return rows.map((r) => ({
    ...r,
    name: nameMap.get(r.sellerId) ?? r.sellerId,
    payoutCardMasked: cardMap.get(r.sellerId) ?? null,
  }));
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

  const available = await sellerAvailableUzs(sellerId);
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

/** Seller requests a withdrawal of their full available balance (status REQUESTED). */
export async function requestPayout(seller: User) {
  const { availableUzs } = await getSellerEarnings(seller.id);
  if (availableUzs <= 0) throw Errors.validation({ amount: "No withdrawable balance" });
  const existing = await prisma.payoutRequest.findFirst({
    where: { sellerId: seller.id, status: "REQUESTED" },
  });
  if (existing) throw Errors.conflict("You already have a pending payout request");
  const u = await prisma.user.findUnique({
    where: { id: seller.id },
    select: { payoutCardMasked: true },
  });
  const req = await prisma.payoutRequest.create({
    data: {
      sellerId: seller.id,
      amountUzs: availableUzs,
      cardMasked: u?.payoutCardMasked ?? "—",
      status: "REQUESTED",
    },
  });
  await audit({ actorId: seller.id, action: "payout.request", entity: "PayoutRequest", entityId: req.id });
  return req;
}

/** Pending (seller-requested) payouts awaiting admin action. */
export async function listPayoutRequests() {
  const rows = await prisma.payoutRequest.findMany({
    where: { status: "REQUESTED" },
    orderBy: { createdAt: "asc" },
    include: { seller: NAME_SELECT },
  });
  return rows.map((r) => ({
    id: r.id,
    seller: displayName(r.seller),
    amountUzs: r.amountUzs,
    cardMasked: r.cardMasked,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Admin fulfils a seller's payout request: REQUESTED → PAID + balanced ledger postings. */
export async function fulfillPayoutRequest(admin: User, requestId: string) {
  if (admin.role !== "ADMIN") throw Errors.forbidden("Only an admin can pay out");
  const req = await prisma.payoutRequest.findUnique({ where: { id: requestId } });
  if (!req || req.status !== "REQUESTED") throw Errors.conflict("No such pending payout request");

  const available = await sellerAvailableUzs(req.sellerId);
  if (req.amountUzs > available) throw Errors.conflict(`Amount exceeds available balance (${available})`);

  await prisma.$transaction(async (tx) => {
    await tx.payoutRequest.update({
      where: { id: requestId },
      data: { status: "PAID", processedBy: admin.id },
    });
    await tx.ledgerEntry.createMany({
      data: payoutPostings(req.amountUzs).map((p) => ({
        account: p.account,
        amountUzs: p.amountUzs,
        userId: req.sellerId,
        memo: `Payout request ${requestId} to seller ${req.sellerId}`,
      })),
    });
  });
  await audit({ actorId: admin.id, action: "payout.fulfill", entity: "PayoutRequest", entityId: requestId });
}
