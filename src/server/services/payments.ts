import "server-only";
import { prisma } from "@/lib/prisma";
import type { User, $Enums, Prisma } from "@prisma/client";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";
import { trackEvent } from "@/server/services/activity";
import { paymentPostings, payoutPostings, tipPostings, discountedPaymentPostings, reversalPostings } from "@/lib/commission";
import { notifyAndPush, notifyAdmins } from "@/server/services/notification";
import { onOrderPaid } from "@/server/services/gamification";
import { restoreOrderCredit } from "@/server/services/affiliate";
import { paymentsEnabled } from "@/lib/payments";

const NAME_SELECT = { select: { firstName: true, name: true, username: true } } as const;

type OrderRow = {
  id: string;
  buyerId: string;
  sellerId: string;
  amountUzs: number;
  commissionUzs: number;
  discountUzs: number;
};

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
  if (existing) return false; // already settled — no double post (and no double credit spend)

  // Atomically claim the settlement: only a still-PENDING_PAYMENT order may move to IN_PROGRESS.
  // If it was cancelled/expired between the webhook's pre-check and here — which also restored
  // the reserved credit — this matches 0 rows and we post nothing, rather than resurrecting a
  // cancelled order and booking a discount whose credit was already refunded. (Row-locked, so it
  // serializes against the expiry / cancellation / dispute transactions on the same order.)
  const claimed = await tx.order.updateMany({
    where: { id: order.id, status: "PENDING_PAYMENT" },
    data: { status: "IN_PROGRESS" },
  });
  if (claimed.count === 0) return false;

  // The buyer's coupon + referral credit were already reserved at order creation and are
  // baked into order.discountUzs (so the PSP charge = amountUzs − discountUzs matched). Nothing
  // more to consume here — just post the ledger against that discount.
  const discount = order.discountUzs;

  await tx.transaction.create({
    data: {
      orderId: order.id,
      provider,
      type: "PAYMENT_IN",
      status: "SUCCEEDED",
      // What the buyer actually pays (net of any platform-funded discount + credit).
      amountUzs: order.amountUzs - discount,
      idempotencyKey,
      rawPayload: externalRef ? { externalRef } : undefined,
    },
  });

  const postings =
    discount > 0
      ? discountedPaymentPostings(order.amountUzs, order.commissionUzs, discount)
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

  return true;
}

async function notifySellerPaid(orderId: string, sellerId: string) {
  await notifyAndPush(sellerId, "order.paid", "Toʻlov tasdiqlandi", {
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
  if (posted) {
    void trackEvent("order_paid", { userId: order.buyerId, entityId: orderId, meta: { provider: "MANUAL" } });
    onOrderPaid(order.buyerId);
    await notifySellerPaid(orderId, order.sellerId);
  }
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
    void trackEvent("order_paid", { userId: order.buyerId, entityId: orderId, meta: { provider } });
    onOrderPaid(order.buyerId);
    await notifySellerPaid(orderId, order.sellerId);
  }
}

/**
 * Reverse a PSP settlement when the provider CANCELS a payment it had already performed
 * (e.g. Payme CancelTransaction on a state-2 transaction — the buyer's charge was undone).
 * Without this the seller stays credited for money the buyer got back: a real leak.
 *
 * Idempotent + atomic + conservative:
 *  - Auto-reverses ONLY from a pre-delivery active state (IN_PROGRESS/REVISION): claims the
 *    order → CANCELLED, posts a discount-aware REFUND that claws back the seller credit, and
 *    restores any referral credit — the same balanced reversal a cancellation uses.
 *  - If the order has advanced (DELIVERED/COMPLETED/DISPUTED — the seller may already be
 *    delivering or paid out), it does NOT silently claw back a balance; it flags admins to
 *    resolve via dispute. The webhook still records the provider transaction as CANCELLED.
 * Returns whether the settlement was reversed and whether it needs admin review.
 */
export async function reverseSettlementByProvider(
  orderId: string,
  provider: $Enums.PaymentProvider,
  externalRef?: string
): Promise<{ reversed: boolean; needsReview: boolean }> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { reversed: false, needsReview: false };

  const idem = `order:${orderId}:${provider.toLowerCase()}-cancel-refund`;
  const already = await prisma.transaction.findUnique({ where: { idempotencyKey: idem } });
  if (already) return { reversed: true, needsReview: false }; // already reversed — idempotent

  const REVERSIBLE: $Enums.OrderStatus[] = ["IN_PROGRESS", "REVISION"];
  if (!REVERSIBLE.includes(order.status)) {
    // Nothing safe to auto-reverse. If money was actually taken and the order isn't already
    // closed, a human must decide (refund vs let the delivery stand) — don't touch balances.
    const paid = await prisma.transaction.findFirst({
      where: { orderId, type: "PAYMENT_IN", status: "SUCCEEDED" },
    });
    if (paid && order.status !== "CANCELLED") {
      await notifyAdmins("admin.payment.cancel_review", "⚠️ Toʻlov bekor qilindi — tekshirish kerak", {
        body: `Buyurtma #${orderId.slice(-6)} uchun toʻlov provayder tomonidan bekor qilindi, ammo buyurtma allaqachon ilgarilagan (${order.status}).`,
        link: `/admin/orders`,
      });
      return { reversed: false, needsReview: true };
    }
    return { reversed: false, needsReview: false };
  }

  let reversed = false;
  await prisma.$transaction(async (tx) => {
    // Claim the order atomically — serializes against accept/deliver/dispute on the same order.
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: { in: REVERSIBLE } },
      data: { status: "CANCELLED" },
    });
    if (claimed.count === 0) return; // raced past a reversible state — bail, no refund posted
    const paid = await tx.transaction.findFirst({
      where: { orderId, type: "PAYMENT_IN", status: "SUCCEEDED" },
    });
    const dup = await tx.transaction.findUnique({ where: { idempotencyKey: idem } });
    if (paid && !dup) {
      await tx.transaction.create({
        data: {
          orderId,
          provider,
          type: "REFUND",
          status: "SUCCEEDED",
          amountUzs: order.amountUzs - order.discountUzs,
          idempotencyKey: idem,
          rawPayload: externalRef ? { externalRef } : undefined,
        },
      });
      await tx.ledgerEntry.createMany({
        data: reversalPostings(order.amountUzs, order.commissionUzs, order.discountUzs).map((p) => ({
          orderId,
          account: p.account,
          amountUzs: p.amountUzs,
          userId: p.account === "SELLER_PAYABLE" ? order.sellerId : null,
          memo: `${provider} payment cancelled — reversal for order ${orderId}`,
        })),
      });
    }
    // Return any referral credit reserved on this order. Idempotent, can't double-credit.
    await restoreOrderCredit(tx, order);
    reversed = true;
  });

  if (reversed) {
    await audit({
      actorId: order.sellerId,
      action: "order.payment.cancel",
      entity: "Order",
      entityId: orderId,
      metadata: { provider, externalRef: externalRef ?? null },
    });
    await notifyAndPush(order.buyerId, "order.cancelled", "Buyurtma bekor qilindi", {
      body: "Toʻlov bekor qilindi — buyurtma yopildi.",
      link: `/orders/${orderId}`,
    });
  }
  return { reversed, needsReview: false };
}

/**
 * TEST MODE — free ordering. When enabled, a newly-placed order is auto-settled with no PSP
 * so the full order → chat → delivery → review flow can be exercised end to end without any
 * payment. Enabled only when FREE_ORDERS is set AND no real payment provider is live.
 *
 * GO-LIVE: the primary off-switch is removing FREE_ORDERS (or setting it "0") — do that FIRST.
 * The `!paymentsEnabled()` guard is defense-in-depth only: it trips for a FULLY configured PSP
 * (PAYMENT_PROVIDER set AND all its creds present), but a HALF-configured provider still counts
 * as "not enabled", so free ordering would stay on. Never rely on the guard alone at go-live.
 */
export function freeOrdersEnabled(): boolean {
  const on = process.env.FREE_ORDERS === "1" || process.env.FREE_ORDERS === "true";
  return on && !paymentsEnabled();
}

/**
 * Auto-settle a just-created order for free (test mode). Routes through the SAME idempotent,
 * balanced path as a real payment (provider MANUAL, ref "FREE_TEST"), so the ledger stays
 * balanced and the order moves PENDING_PAYMENT → IN_PROGRESS exactly like a paid one. No-op
 * when free mode is off or the order is no longer awaiting payment. Best-effort: a failure
 * here never breaks order placement (the order simply stays PENDING_PAYMENT).
 */
export async function autoSettleFreeOrderIfEnabled(orderId: string): Promise<void> {
  if (!freeOrdersEnabled()) return;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PENDING_PAYMENT") return;
  let posted = false;
  await prisma.$transaction(async (tx) => {
    posted = await postOrderPaymentTx(tx, order, "MANUAL", "FREE_TEST");
  });
  if (posted) {
    await audit({ actorId: order.buyerId, action: "order.payment.free", entity: "Order", entityId: orderId });
    void trackEvent("order_paid", { userId: order.buyerId, entityId: orderId, meta: { provider: "FREE_TEST" } });
    onOrderPaid(order.buyerId);
    await notifySellerPaid(orderId, order.sellerId);
  }
}

/** Total successful tips received by a seller (across all their orders). */
async function sellerTipsTotal(sellerId: string, db: Prisma.TransactionClient = prisma): Promise<number> {
  const tips = await db.transaction.findMany({
    // Tips on test orders never contribute withdrawable balance (qa review C1 — tip channel).
    where: { type: "TIP", status: "SUCCEEDED", order: { sellerId, isTest: false } },
    select: { amountUzs: true },
  });
  return tips.reduce((a, t) => a + t.amountUzs, 0);
}

/** Buyer tips the seller on a COMPLETED order — fully credited to the seller (no commission). */
export async function tipOrder(orderId: string, buyer: User, amountUzs: number, idempotencyKey?: string) {
  if (!Number.isInteger(amountUzs) || amountUzs < 1000 || amountUzs > 10_000_000) {
    throw Errors.validation({ amountUzs: "Invalid tip amount" });
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Errors.notFound("Order not found");
  if (order.buyerId !== buyer.id) throw Errors.forbidden();
  if (order.status !== "COMPLETED") throw Errors.conflict("You can tip only after completion");
  // No tips on free test orders — they must never write a TIP row or seed a real balance
  // (qa review C1 — tip channel; belt-and-suspenders with the sellerTipsTotal filter).
  if (order.isTest) throw Errors.conflict("Tips are disabled for test orders");

  // Idempotency: a retried / double-submitted tip (same client key) must not double-credit
  // the seller. The key is unique on Transaction, so the second write is a no-op.
  const idem = `order:${orderId}:tip:${idempotencyKey ?? crypto.randomUUID()}`;
  let posted = false;
  try {
    posted = await prisma.$transaction(async (tx) => {
      const already = await tx.transaction.findUnique({ where: { idempotencyKey: idem } });
      if (already) return false;
      await tx.transaction.create({
        data: { orderId, provider: "MANUAL", type: "TIP", status: "SUCCEEDED", amountUzs, idempotencyKey: idem },
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
      return true;
    });
  } catch (e) {
    // A truly simultaneous same-key tip lost the unique race — that's the idempotent
    // outcome (the winner recorded it), so treat it as success, not a 500.
    if ((e as { code?: string })?.code === "P2002") return;
    throw e;
  }
  if (!posted) return; // already recorded — no double audit/notify
  await audit({ actorId: buyer.id, action: "order.tip", entity: "Order", entityId: orderId });
  await notifyAndPush(order.sellerId, "order.tip", "Choychaqa oldingiz", {
    body: "Buyurtmachi sizga choychaqa qoldirdi.",
    link: `/orders/${orderId}`,
  });
}

/**
 * Single source of truth for a seller's withdrawable balance: completed net earnings + tips
 * − amounts already paid out. Every payout path (UI balance, request, admin fulfil) MUST use
 * this so the seller-facing balance and the payout ceiling can never disagree.
 */
export async function sellerAvailableUzs(
  sellerId: string,
  db: Prisma.TransactionClient = prisma
): Promise<number> {
  const [completed, payouts, tips] = await Promise.all([
    // isTest orders never contribute withdrawable balance (qa review C1).
    db.order.aggregate({ where: { sellerId, status: "COMPLETED", isTest: false }, _sum: { sellerNetUzs: true } }),
    db.payoutRequest.aggregate({ where: { sellerId, status: "PAID" }, _sum: { amountUzs: true } }),
    sellerTipsTotal(sellerId, db),
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
    // Exclude test orders from both held and lifetime earnings (qa review C1).
    where: { sellerId, isTest: false },
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
    prisma.order.groupBy({ by: ["sellerId"], where: { status: "COMPLETED", isTest: false }, _sum: { sellerNetUzs: true } }),
    prisma.payoutRequest.groupBy({ by: ["sellerId"], where: { status: "PAID" }, _sum: { amountUzs: true } }),
    prisma.transaction.findMany({
      // Exclude test-order tips from the admin payout console's balances (qa review C1).
      where: { type: "TIP", status: "SUCCEEDED", order: { isTest: false } },
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

  await prisma.$transaction(async (tx) => {
    // Serialize ALL payouts for this seller: the balance is an aggregate SUM that does not
    // lock the rows it reads, so without this a second concurrent payout (another admin, a
    // different REQUESTED row, a double-click) reads the same balance and also passes —
    // over-withdrawing. A transaction-scoped advisory lock auto-releases on commit/rollback.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sellerId}))`;
    const available = await sellerAvailableUzs(sellerId, tx);
    if (amountUzs > available) throw Errors.conflict(`Amount exceeds available balance (${available})`);
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
  await notifyAdmins("admin.payout", "💸 Yangi toʻlov soʻrovi", {
    body: `${req.amountUzs.toLocaleString("ru-RU")} soʻm — koʻrib chiqing.`,
    link: "/admin/settlements",
  });
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

  await prisma.$transaction(async (tx) => {
    // Serialize all payouts for this seller (see recordPayout) so a concurrent fulfil of a
    // DIFFERENT request or a recordPayout can't both pass the unlocked aggregate balance check.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${req.sellerId}))`;
    // Re-fetch + balance check inside the transaction: concurrent fulfilments of the
    // same request (double-click) or overlapping payouts must not both pass.
    const fresh = await tx.payoutRequest.findUnique({ where: { id: requestId } });
    if (!fresh || fresh.status !== "REQUESTED") throw Errors.conflict("No such pending payout request");
    const available = await sellerAvailableUzs(req.sellerId, tx);
    if (req.amountUzs > available) throw Errors.conflict(`Amount exceeds available balance (${available})`);
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
  await notifyAndPush(req.sellerId, "payout.paid", "Toʻlov amalga oshirildi", {
    body: `${req.amountUzs.toLocaleString("ru-RU")} soʻm hisobingizga oʻtkazildi.`,
    link: `/dashboard/seller`,
  });
}
