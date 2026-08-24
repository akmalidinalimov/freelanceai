/**
 * Order work-phase RACE integration tests — against a real Postgres.
 *
 * Proves the T2 fix: the money-adjacent status transitions now claim the order atomically
 * (updateMany WHERE status = expectedFrom), so two conflicting operations can never BOTH
 * settle — the failure mode was "buyer refunded AND seller credited via the COMPLETED
 * balance". The decisive invariant asserted below: an order is never simultaneously
 * COMPLETED and holding a REFUND.
 */
import { describe, it, expect, afterAll } from "vitest";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { confirmOrderPayment, sellerAvailableUzs } from "@/server/services/payments";
import { deliverOrder, acceptOrder, requestRevision } from "@/server/services/order";
import { openDispute, resolveDispute } from "@/server/services/dispute";

let seq = 0;
const ids: string[] = [];

/** Seed a fully-PAID, DELIVERED order (PAYMENT_IN posted) + its actors. */
async function seedDelivered() {
  const n = ++seq;
  const sellerId = `rc_seller_${n}`;
  const buyerId = `rc_buyer_${n}`;
  const adminId = `rc_admin_${n}`;
  const gigId = `rc_gig_${n}`;
  const orderId = `rc_order_${n}`;
  ids.push(sellerId, buyerId, adminId);

  await prisma.user.create({ data: { id: sellerId, firstName: "S", username: sellerId, isSeller: true, role: "BUYER", status: "ACTIVE", onboardingCompleted: true } });
  await prisma.user.create({ data: { id: buyerId, firstName: "B", username: buyerId, role: "BUYER", status: "ACTIVE", onboardingCompleted: true } });
  await prisma.user.create({ data: { id: adminId, firstName: "A", username: adminId, role: "ADMIN", status: "ACTIVE", onboardingCompleted: true } });
  await prisma.gig.create({ data: { id: gigId, sellerId, title: `RC gig ${n}`, slug: gigId, description: "race test gig", status: "ACTIVE", locale: "uz" } });
  await prisma.order.create({
    data: {
      id: orderId, gigId, buyerId, sellerId, packageTier: "BASIC", packageTitle: "Basic",
      amountUzs: 100_000, commissionUzs: 20_000, sellerNetUzs: 80_000, discountUzs: 0,
      status: "PENDING_PAYMENT",
    },
  });
  const admin = (await prisma.user.findUnique({ where: { id: adminId } })) as User;
  const buyer = (await prisma.user.findUnique({ where: { id: buyerId } })) as User;
  const seller = (await prisma.user.findUnique({ where: { id: sellerId } })) as User;

  await confirmOrderPayment(orderId, admin); // PENDING_PAYMENT → IN_PROGRESS, PAYMENT_IN posted
  await deliverOrder(orderId, seller, "done"); // IN_PROGRESS → DELIVERED
  return { orderId, admin, buyer, seller, sellerId };
}

afterAll(async () => {
  await prisma.dispute.deleteMany({ where: { order: { sellerId: { in: ids } } } }).catch(() => {});
  await prisma.cancellationRequest.deleteMany({ where: { order: { sellerId: { in: ids } } } }).catch(() => {});
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

/** The order is never both paid-to-seller (COMPLETED) and refunded-to-buyer. */
async function assertNoDoubleSettle(orderId: string, sellerId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const refunds = await prisma.transaction.count({ where: { orderId, type: "REFUND", status: "SUCCEEDED" } });
  expect(["COMPLETED", "CANCELLED"]).toContain(order.status); // exactly one terminal state
  expect(order.status === "COMPLETED" && refunds > 0).toBe(false); // the double-settle invariant
  if (order.status === "CANCELLED") {
    expect(refunds).toBe(1); // refund posted exactly once
    expect(await sellerAvailableUzs(sellerId)).toBe(0); // seller not paid
  } else {
    expect(refunds).toBe(0); // completed → no refund
    expect(await sellerAvailableUzs(sellerId)).toBe(80_000); // seller paid the net
  }
}

describe("order work-phase races (T2)", () => {
  it("concurrent accept vs request-revision: exactly one wins (atomic claim)", async () => {
    const s = await seedDelivered(); // DELIVERED → both COMPLETED (accept) and REVISION are valid
    const r = await Promise.allSettled([
      acceptOrder(s.orderId, s.buyer),
      requestRevision(s.orderId, s.buyer),
    ]);
    // The atomic status claim guarantees exactly one commits; the other conflicts.
    expect(r.filter((x) => x.status === "fulfilled").length).toBe(1);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: s.orderId } });
    expect(["COMPLETED", "REVISION"]).toContain(order.status);
    // Seller is credited iff the accept won — never a half-applied both.
    expect(await sellerAvailableUzs(s.sellerId)).toBe(order.status === "COMPLETED" ? 80_000 : 0);
  });

  it("concurrent dispute resolve (refund vs release) never double-settles", async () => {
    const s = await seedDelivered();
    await openDispute(s.orderId, s.buyer, "work not as described"); // DELIVERED → DISPUTED

    const did = await disputeId(s.orderId);
    const r = await Promise.allSettled([
      resolveDispute(did, s.admin, "refund"),
      resolveDispute(did, s.admin, "release"),
    ]);
    expect(r.filter((x) => x.status === "fulfilled").length).toBe(1); // exactly one resolution
    const d = await prisma.dispute.findFirstOrThrow({ where: { orderId: s.orderId } });
    expect(["RESOLVED_REFUND", "RESOLVED_RELEASE"]).toContain(d.status);
    await assertNoDoubleSettle(s.orderId, s.sellerId);
  });
});

async function disputeId(orderId: string): Promise<string> {
  const d = await prisma.dispute.findFirstOrThrow({ where: { orderId } });
  return d.id;
}
