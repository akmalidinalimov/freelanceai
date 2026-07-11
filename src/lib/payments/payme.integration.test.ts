/**
 * Payme adapter money-path INTEGRATION tests — against a real Postgres.
 *
 * Proves the T5 fixes on the JSON-RPC handler:
 *   P0. CancelTransaction on a PERFORMED payment REVERSES the settlement — the order goes
 *       back to CANCELLED, a discount-aware REFUND is posted, and the seller credit is
 *       clawed back. Previously Cancel only flipped the txn row, leaking the seller a
 *       balance for money the buyer got back.
 *   P1. A SECOND CreateTransaction (new Payme id) for an order that already has an active
 *       transaction is rejected — the buyer can't be charged twice.
 */
import { describe, it, expect, afterAll } from "vitest";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handlePaymeRpc } from "@/lib/payments/payme";
import { getSellerEarnings, sellerAvailableUzs } from "@/server/services/payments";
import { deliverOrder } from "@/server/services/order";

/** Net SELLER_PAYABLE ledger movement for an order — must be 0 once a payment is reversed. */
async function sellerPayableLedger(orderId: string): Promise<number> {
  const agg = await prisma.ledgerEntry.aggregate({
    where: { orderId, account: "SELLER_PAYABLE" },
    _sum: { amountUzs: true },
  });
  return agg._sum.amountUzs ?? 0;
}

let seq = 0;
const ids: string[] = [];

/** Seed a PENDING_PAYMENT Payme order (no discount) + its actors. */
async function seedPending(amountUzs = 100_000, commissionUzs = 20_000) {
  const n = ++seq;
  const sellerId = `pm_seller_${n}`;
  const buyerId = `pm_buyer_${n}`;
  const gigId = `pm_gig_${n}`;
  const orderId = `pm_order_${n}`;
  ids.push(sellerId, buyerId);
  await prisma.user.create({ data: { id: sellerId, firstName: "S", username: sellerId, isSeller: true, role: "BUYER", status: "ACTIVE", onboardingCompleted: true } });
  await prisma.user.create({ data: { id: buyerId, firstName: "B", username: buyerId, role: "BUYER", status: "ACTIVE", onboardingCompleted: true } });
  await prisma.gig.create({ data: { id: gigId, sellerId, title: `PM gig ${n}`, slug: gigId, description: "payme test gig", status: "ACTIVE", locale: "uz" } });
  await prisma.order.create({
    data: {
      id: orderId, gigId, buyerId, sellerId, packageTier: "BASIC", packageTitle: "Basic",
      amountUzs, commissionUzs, sellerNetUzs: amountUzs - commissionUzs, discountUzs: 0,
      status: "PENDING_PAYMENT",
    },
  });
  return { orderId, sellerId, buyerId, amountUzs, commissionUzs };
}

afterAll(async () => {
  await prisma.dispute.deleteMany({ where: { order: { sellerId: { in: ids } } } }).catch(() => {});
  await prisma.orderDelivery.deleteMany({ where: { order: { sellerId: { in: ids } } } }).catch(() => {});
  await prisma.ledgerEntry.deleteMany({ where: { order: { sellerId: { in: ids } } } }).catch(() => {});
  await prisma.transaction.deleteMany({ where: { order: { sellerId: { in: ids } } } }).catch(() => {});
  await prisma.order.deleteMany({ where: { sellerId: { in: ids } } }).catch(() => {});
  await prisma.gig.deleteMany({ where: { sellerId: { in: ids } } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await prisma.$disconnect();
});

const hasError = (r: unknown): r is { error: { code: number } } =>
  typeof r === "object" && r !== null && "error" in r;

describe("Payme adapter money paths (T5)", () => {
  it("P0: Cancel of a performed payment reverses the settlement (seller credit clawed back)", async () => {
    const s = await seedPending();
    const paymeId = `pmtxn_${s.orderId}`;
    const amount = s.amountUzs * 100; // tiyin, no discount

    // Create → Perform: order settles, seller is credited the net.
    const created = await handlePaymeRpc({ id: 1, method: "CreateTransaction", params: { id: paymeId, time: Date.now(), amount, account: { order_id: s.orderId } } });
    expect(hasError(created)).toBe(false);
    const performed = await handlePaymeRpc({ id: 2, method: "PerformTransaction", params: { id: paymeId } });
    expect(hasError(performed)).toBe(false);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: s.orderId } })).status).toBe("IN_PROGRESS");
    // Settled: the seller now holds the net in escrow, and the ledger credited SELLER_PAYABLE.
    expect((await getSellerEarnings(s.sellerId)).heldUzs).toBe(s.amountUzs - s.commissionUzs);
    expect(await sellerPayableLedger(s.orderId)).toBe(-(s.amountUzs - s.commissionUzs)); // credit owed

    // Cancel the performed payment → settlement reversed.
    const cancelled = await handlePaymeRpc({ id: 3, method: "CancelTransaction", params: { id: paymeId, reason: 5 } });
    expect(hasError(cancelled)).toBe(false);
    expect((cancelled as { result: { state: number } }).result.state).toBe(-2); // performed → reversed

    const order = await prisma.order.findUniqueOrThrow({ where: { id: s.orderId } });
    const refunds = await prisma.transaction.count({ where: { orderId: s.orderId, type: "REFUND", status: "SUCCEEDED" } });
    expect(order.status).toBe("CANCELLED"); // order closed — can never reach COMPLETED / pay out
    expect(refunds).toBe(1); // refund posted exactly once
    expect((await getSellerEarnings(s.sellerId)).heldUzs).toBe(0); // no longer held
    expect(await sellerPayableLedger(s.orderId)).toBe(0); // credit clawed back — double-entry balanced

    // Idempotent: a Payme retry of Cancel neither double-refunds nor throws.
    await handlePaymeRpc({ id: 4, method: "CancelTransaction", params: { id: paymeId, reason: 5 } });
    expect(await prisma.transaction.count({ where: { orderId: s.orderId, type: "REFUND", status: "SUCCEEDED" } })).toBe(1);
    expect(await sellerPayableLedger(s.orderId)).toBe(0);
  });

  it("P0-freeze: cancelling an already-DELIVERED order freezes it (DISPUTED) instead of leaking", async () => {
    const s = await seedPending();
    const paymeId = `pmtxn_dlv_${s.orderId}`;
    const amount = s.amountUzs * 100;
    await handlePaymeRpc({ id: 1, method: "CreateTransaction", params: { id: paymeId, time: Date.now(), amount, account: { order_id: s.orderId } } });
    await handlePaymeRpc({ id: 2, method: "PerformTransaction", params: { id: paymeId } });
    // Advance the order past the auto-reversible window: seller delivers → DELIVERED.
    const seller = (await prisma.user.findUniqueOrThrow({ where: { id: s.sellerId } })) as User;
    await deliverOrder(s.orderId, seller, "done");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: s.orderId } })).status).toBe("DELIVERED");

    // Cancel now: NOT auto-reversed (seller may be owed the delivery), but must be FROZEN so the
    // 3-day auto-complete cron can't release the clawed-back money before an admin decides.
    await handlePaymeRpc({ id: 3, method: "CancelTransaction", params: { id: paymeId, reason: 5 } });

    const order = await prisma.order.findUniqueOrThrow({ where: { id: s.orderId } });
    expect(order.status).toBe("DISPUTED"); // frozen — auto-complete selects DELIVERED only, skips this
    const dispute = await prisma.dispute.findFirst({ where: { orderId: s.orderId } });
    expect(dispute?.status).toBe("OPEN"); // routes to the admin refund/release flow
    const refunds = await prisma.transaction.count({ where: { orderId: s.orderId, type: "REFUND", status: "SUCCEEDED" } });
    expect(refunds).toBe(0); // NOT auto-refunded — admin decides
    expect(await sellerAvailableUzs(s.sellerId)).toBe(0); // never became withdrawable
  });

  it("P1: a second CreateTransaction for an already-active order is rejected (no double charge)", async () => {
    const s = await seedPending();
    const amount = s.amountUzs * 100;
    const first = await handlePaymeRpc({ id: 1, method: "CreateTransaction", params: { id: `pm_a_${s.orderId}`, time: Date.now(), amount, account: { order_id: s.orderId } } });
    expect(hasError(first)).toBe(false);

    // A different Payme id for the SAME pending order must be refused.
    const second = await handlePaymeRpc({ id: 2, method: "CreateTransaction", params: { id: `pm_b_${s.orderId}`, time: Date.now(), amount, account: { order_id: s.orderId } } });
    expect(hasError(second)).toBe(true);
    expect((second as { error: { code: number } }).error.code).toBe(-31008); // CANT_PERFORM

    // Only the first transaction exists for the order.
    const count = await prisma.transaction.count({ where: { orderId: s.orderId, provider: "PAYME" } });
    expect(count).toBe(1);

    // The SAME id is still idempotent (returns the existing transaction, not an error).
    const retry = await handlePaymeRpc({ id: 3, method: "CreateTransaction", params: { id: `pm_a_${s.orderId}`, time: Date.now(), amount, account: { order_id: s.orderId } } });
    expect(hasError(retry)).toBe(false);
  });
});
