/**
 * Coupon over-redemption RACE integration test — against a real Postgres.
 *
 * Proves the T7 fix: coupon redemption is claimed atomically (updateMany WHERE uses < maxUses)
 * inside the order-creation tx, so N concurrent orders on a maxUses=1 code can't ALL pass
 * findValidCoupon's uses<maxUses read and each increment — the platform would fund more
 * discount than it authorized. Exactly one order gets the discount; the coupon never exceeds
 * maxUses; the losers proceed at full price rather than failing.
 */
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/server/services/order";

let seq = 0;
const ids: string[] = [];
const codes: string[] = [];

async function seedGigAndCoupon(maxUses: number) {
  const n = ++seq;
  const sellerId = `cp_seller_${n}`;
  const gigId = `cp_gig_${n}`;
  const code = `CPRACE${n}`;
  ids.push(sellerId);
  codes.push(code);
  await prisma.user.create({ data: { id: sellerId, firstName: "S", username: sellerId, isSeller: true, role: "BUYER", status: "ACTIVE", onboardingCompleted: true } });
  await prisma.gig.create({
    data: {
      id: gigId, sellerId, title: `CP gig ${n}`, slug: gigId, description: "coupon race gig",
      status: "ACTIVE", locale: "uz",
      packages: { create: { tier: "BASIC", title: "Basic", priceUzs: 100_000, deliveryDays: 3 } },
    },
  });
  await prisma.coupon.create({
    data: { code, amountOffUzs: 10_000, maxUses, uses: 0, active: true },
  });
  const buyerIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const bid = `cp_buyer_${n}_${i}`;
    buyerIds.push(bid);
    ids.push(bid);
    await prisma.user.create({ data: { id: bid, firstName: "B", username: bid, role: "BUYER", status: "ACTIVE", onboardingCompleted: true } });
  }
  return { gigId, code, buyerIds };
}

afterAll(async () => {
  await prisma.order.deleteMany({ where: { sellerId: { in: ids } } }).catch(() => {});
  await prisma.gigPackage.deleteMany({ where: { gig: { sellerId: { in: ids } } } }).catch(() => {});
  await prisma.gig.deleteMany({ where: { sellerId: { in: ids } } }).catch(() => {});
  await prisma.coupon.deleteMany({ where: { code: { in: codes } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("coupon over-redemption race (T7)", () => {
  it("4 concurrent orders on a maxUses=1 code redeem it exactly once", async () => {
    const s = await seedGigAndCoupon(1);
    const results = await Promise.allSettled(
      s.buyerIds.map((bid) => createOrder(bid, s.gigId, "BASIC", undefined, [], [], s.code))
    );
    const orders = results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<{ discountUzs: number }>).value);
    expect(orders.length).toBe(4); // every order still succeeds (losers just pay full price)

    const discounted = orders.filter((o) => o.discountUzs > 0);
    expect(discounted.length).toBe(1); // exactly ONE got the platform-funded discount
    expect(discounted[0].discountUzs).toBe(10_000);

    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { code: s.code } });
    expect(coupon.uses).toBe(1); // never over-redeemed past maxUses
  });

  it("with maxUses=2, exactly two of four concurrent orders redeem", async () => {
    const s = await seedGigAndCoupon(2);
    const results = await Promise.allSettled(
      s.buyerIds.map((bid) => createOrder(bid, s.gigId, "BASIC", undefined, [], [], s.code))
    );
    const orders = results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<{ discountUzs: number }>).value);
    expect(orders.filter((o) => o.discountUzs > 0).length).toBe(2);
    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { code: s.code } });
    expect(coupon.uses).toBe(2);
  });
});
