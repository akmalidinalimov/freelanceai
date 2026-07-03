/**
 * Money-path INTEGRATION tests — run against a real Postgres (advisory locks + aggregate
 * balance reads + unique constraints can't be exercised by mocks/SQLite). Executed by the
 * `integration` CI job (a postgres service container) and locally via
 * `npm run test:integration` with DATABASE_URL pointing at a throwaway DB.
 *
 * These prove the two money-critical fixes from the code verification:
 *   1. Payout balance race (advisory lock) — two concurrent same-seller payouts can't
 *      both pass the balance ceiling and over-withdraw.
 *   2. Tip double-credit (idempotency key) — a concurrent same-key tip credits once.
 */
import { describe, it, expect, afterAll } from "vitest";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fulfillPayoutRequest, tipOrder, sellerAvailableUzs } from "@/server/services/payments";

let seq = 0;
const ids: string[] = [];

/** Create a seller with a single COMPLETED order worth `netUzs`, plus a buyer and an admin. */
async function seed(netUzs: number) {
  const n = ++seq;
  const sellerId = `it_seller_${n}`;
  const buyerId = `it_buyer_${n}`;
  const adminId = `it_admin_${n}`;
  const gigId = `it_gig_${n}`;
  const orderId = `it_order_${n}`;
  ids.push(sellerId, buyerId, adminId);

  await prisma.user.create({
    data: { id: sellerId, firstName: "Seller", username: sellerId, isSeller: true, role: "BUYER", status: "ACTIVE", onboardingCompleted: true },
  });
  await prisma.user.create({
    data: { id: buyerId, firstName: "Buyer", username: buyerId, role: "BUYER", status: "ACTIVE", onboardingCompleted: true },
  });
  await prisma.user.create({
    data: { id: adminId, firstName: "Admin", username: adminId, role: "ADMIN", status: "ACTIVE", onboardingCompleted: true },
  });
  await prisma.gig.create({
    data: { id: gigId, sellerId, title: `IT gig ${n}`, slug: gigId, description: "integration test gig", status: "ACTIVE", locale: "uz" },
  });
  await prisma.order.create({
    data: {
      id: orderId, gigId, buyerId, sellerId, packageTier: "BASIC", packageTitle: "Basic",
      amountUzs: netUzs, sellerNetUzs: netUzs, status: "COMPLETED", completedAt: new Date(),
    },
  });
  const admin = (await prisma.user.findUnique({ where: { id: adminId } })) as User;
  const buyer = (await prisma.user.findUnique({ where: { id: buyerId } })) as User;
  return { sellerId, buyerId, adminId, gigId, orderId, admin, buyer };
}

afterAll(async () => {
  // Best-effort cleanup so re-runs on a persistent DB stay independent.
  await prisma.ledgerEntry.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.transaction.deleteMany({ where: { order: { sellerId: { in: ids } } } }).catch(() => {});
  await prisma.payoutRequest.deleteMany({ where: { sellerId: { in: ids } } }).catch(() => {});
  await prisma.order.deleteMany({ where: { sellerId: { in: ids } } }).catch(() => {});
  await prisma.gig.deleteMany({ where: { sellerId: { in: ids } } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("payout balance race (advisory lock)", () => {
  it("two concurrent same-seller payouts for the full balance: exactly one succeeds, no over-withdraw", async () => {
    const s = await seed(100_000);
    expect(await sellerAvailableUzs(s.sellerId)).toBe(100_000);

    // Two separate REQUESTED payout rows, each for the whole balance.
    const req1 = await prisma.payoutRequest.create({ data: { sellerId: s.sellerId, amountUzs: 100_000, cardMasked: "**** 1111", status: "REQUESTED" } });
    const req2 = await prisma.payoutRequest.create({ data: { sellerId: s.sellerId, amountUzs: 100_000, cardMasked: "**** 2222", status: "REQUESTED" } });

    // Fire both fulfilments concurrently — the advisory lock must serialize them.
    const results = await Promise.allSettled([
      fulfillPayoutRequest(s.admin, req1.id),
      fulfillPayoutRequest(s.admin, req2.id),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected").length;
    expect(fulfilled).toBe(1); // exactly one paid
    expect(rejected).toBe(1); // the other rejected on the balance ceiling

    const paid = await prisma.payoutRequest.count({ where: { sellerId: s.sellerId, status: "PAID" } });
    expect(paid).toBe(1);
    // Balance is exactly zero — never negative (which is what the race would have caused).
    expect(await sellerAvailableUzs(s.sellerId)).toBe(0);
  });
});

describe("tip idempotency", () => {
  it("concurrent same-key tips credit the seller exactly once", async () => {
    const s = await seed(0); // balance not needed for tips
    const KEY = `it-tip-key-${seq}`;

    await Promise.allSettled([
      tipOrder(s.orderId, s.buyer, 25_000, KEY),
      tipOrder(s.orderId, s.buyer, 25_000, KEY),
    ]);

    const tips = await prisma.transaction.count({ where: { orderId: s.orderId, type: "TIP" } });
    expect(tips).toBe(1); // no double-credit

    // Ledger for the tip nets to zero (double-entry invariant).
    const entries = await prisma.ledgerEntry.findMany({ where: { orderId: s.orderId } });
    expect(entries.reduce((a, e) => a + e.amountUzs, 0)).toBe(0);
    // Seller's withdrawable balance reflects exactly one tip.
    expect(await sellerAvailableUzs(s.sellerId)).toBe(25_000);
  });

  it("a distinct key allows a second, separate tip", async () => {
    const s = await seed(0);
    await tipOrder(s.orderId, s.buyer, 10_000, `it-a-${seq}`);
    await tipOrder(s.orderId, s.buyer, 10_000, `it-b-${seq}`);
    const tips = await prisma.transaction.count({ where: { orderId: s.orderId, type: "TIP" } });
    expect(tips).toBe(2);
    expect(await sellerAvailableUzs(s.sellerId)).toBe(20_000);
  });
});
