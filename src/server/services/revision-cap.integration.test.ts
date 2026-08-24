/**
 * Included revisions are now enforced (audit 2026-08-10, S11).
 *
 * Every package advertises "N revisions included" and requestRevision checked only the state
 * machine, so a buyer could ask for revisions forever while the seller had agreed to a fixed
 * number. The allowance is snapshotted onto the order at creation — the seller can edit the
 * package afterwards, and the buyer is owed what was advertised when they paid.
 */
import { describe, it, expect, afterAll } from "vitest";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requestRevision, deliverOrder } from "@/server/services/order";

let seq = 0;
const ids: string[] = [];

async function scenario(revisionsIncluded: number | null) {
  const n = ++seq;
  const stamp = `${n}_${Date.now()}`;
  const sellerId = `rv_seller_${stamp}`;
  const buyerId = `rv_buyer_${stamp}`;
  ids.push(sellerId, buyerId);
  await prisma.user.create({
    data: { id: sellerId, firstName: "Seller", username: sellerId, isSeller: true, role: "BUYER", status: "ACTIVE", onboardingCompleted: true },
  });
  const buyer = await prisma.user.create({
    data: { id: buyerId, firstName: "Buyer", username: buyerId, role: "BUYER", status: "ACTIVE", onboardingCompleted: true },
  });
  const seller = (await prisma.user.findUnique({ where: { id: sellerId } })) as User;
  const gig = await prisma.gig.create({
    data: { sellerId, title: `rv gig ${n}`, slug: `rv-gig-${stamp}`, description: "revision cap fixture", status: "ACTIVE", locale: "uz" },
  });
  const order = await prisma.order.create({
    data: {
      gigId: gig.id, buyerId, sellerId, packageTier: "BASIC", packageTitle: "Basic",
      amountUzs: 100_000, sellerNetUzs: 80_000, status: "DELIVERED", deliveredAt: new Date(),
      revisionsIncluded, revisionsUsed: 0,
    },
  });
  return { order, buyer, seller, gigId: gig.id };
}

/** Seller re-delivers so the buyer can ask again. */
const redeliver = (orderId: string, seller: User) => deliverOrder(orderId, seller, "v2", []);

afterAll(async () => {
  await prisma.order.deleteMany({ where: { buyerId: { in: ids } } }).catch(() => {});
  await prisma.gig.deleteMany({ where: { sellerId: { in: ids } } }).catch(() => {});
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("S11 — included revisions are enforced", () => {
  it("a 1-revision package allows one, then refuses the second", async () => {
    const { order, buyer, seller } = await scenario(1);

    await requestRevision(order.id, buyer, "please change the logo");
    expect((await prisma.order.findUnique({ where: { id: order.id } }))?.revisionsUsed).toBe(1);

    await redeliver(order.id, seller);
    await expect(requestRevision(order.id, buyer, "one more thing")).rejects.toThrow();

    const after = await prisma.order.findUnique({ where: { id: order.id } });
    expect(after?.status, "the re-delivery stands; the extra request is refused").toBe("DELIVERED");
    expect(after?.revisionsUsed).toBe(1);
  });

  it("a 2-revision package allows exactly two", async () => {
    const { order, buyer, seller } = await scenario(2);

    await requestRevision(order.id, buyer, "first");
    await redeliver(order.id, seller);
    await requestRevision(order.id, buyer, "second");
    await redeliver(order.id, seller);

    await expect(requestRevision(order.id, buyer, "third")).rejects.toThrow();
    expect((await prisma.order.findUnique({ where: { id: order.id } }))?.revisionsUsed).toBe(2);
  });

  it("a legacy order with no snapshotted allowance stays unenforced", async () => {
    // Orders placed before this shipped, whose package could not be resolved, must not have a
    // limit invented for them retroactively.
    const { order, buyer, seller } = await scenario(null);

    await requestRevision(order.id, buyer, "a");
    await redeliver(order.id, seller);
    await requestRevision(order.id, buyer, "b");

    expect((await prisma.order.findUnique({ where: { id: order.id } }))?.status).toBe("REVISION");
  });

  it("an admin can still force a revision past the cap", async () => {
    const { order, seller } = await scenario(1);
    const adminId = `rv_admin_${++seq}_${Date.now()}`;
    ids.push(adminId);
    const admin = await prisma.user.create({
      data: { id: adminId, firstName: "Admin", username: adminId, role: "ADMIN", status: "ACTIVE", onboardingCompleted: true },
    });

    await prisma.order.update({ where: { id: order.id }, data: { revisionsUsed: 5 } });
    await redeliver(order.id, seller).catch(() => {});
    await prisma.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });

    await requestRevision(order.id, admin, "support override");
    expect((await prisma.order.findUnique({ where: { id: order.id } }))?.status).toBe("REVISION");
  });
});
