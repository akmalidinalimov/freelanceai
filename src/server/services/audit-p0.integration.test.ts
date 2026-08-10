/**
 * Regression tests for the two live P0 findings from the 2026-08-10 audit
 * (docs/audit/2026-08-10/04-SPECS.md, specs S1 and S3).
 *
 * Real Postgres, because both invariants are about what a row is allowed to become:
 *
 *   S1 — a seller must not be able to move their own gig to ACTIVE. Moving a gig live is an
 *        admin transition; `resume` was owner-scoped but carried no precondition on the current
 *        status, so PENDING_REVIEW -> ACTIVE was one request (and one button in the UI).
 *
 *   S3 — a review must require a REAL order. The gate checked COMPLETED but never isTest, and
 *        with FREE_ORDERS=1 every order is a free test order, so the whole
 *        create -> deliver -> accept -> review loop cost nothing and fed public ratings,
 *        Trending, and Google rich-results structured data.
 */
import { describe, it, expect, afterAll } from "vitest";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resumeGig, pauseGig } from "@/server/services/gig";
import { createReview, getGigReviews } from "@/server/services/review";

let seq = 0;
const userIds: string[] = [];
const gigIds: string[] = [];

async function seller(): Promise<User> {
  const id = `p0_seller_${++seq}_${Date.now()}`;
  userIds.push(id);
  return prisma.user.create({
    data: { id, firstName: "Seller", username: id, isSeller: true, role: "BUYER", status: "ACTIVE", onboardingCompleted: true },
  });
}

async function buyer(): Promise<User> {
  const id = `p0_buyer_${++seq}_${Date.now()}`;
  userIds.push(id);
  return prisma.user.create({
    data: { id, firstName: "Buyer", username: id, role: "BUYER", status: "ACTIVE", onboardingCompleted: true },
  });
}

async function gig(sellerId: string, status: "PENDING_REVIEW" | "ACTIVE" | "PAUSED" | "DRAFT") {
  const g = await prisma.gig.create({
    data: {
      sellerId, title: `p0 gig ${++seq}`, slug: `p0-gig-${seq}-${Date.now()}`,
      description: "audit regression fixture", status, locale: "uz",
    },
  });
  gigIds.push(g.id);
  return g;
}

/** A completed order, test or real, ready to be reviewed. */
async function completedOrder(sellerId: string, buyerId: string, gigId: string, isTest: boolean) {
  return prisma.order.create({
    data: {
      gigId, buyerId, sellerId, packageTier: "BASIC", packageTitle: "Basic",
      amountUzs: 100_000, sellerNetUzs: 80_000, status: "COMPLETED",
      isTest, completedAt: new Date(), deliveredAt: new Date(),
    },
  });
}

afterAll(async () => {
  await prisma.review.deleteMany({ where: { gigId: { in: gigIds } } }).catch(() => {});
  await prisma.order.deleteMany({ where: { gigId: { in: gigIds } } }).catch(() => {});
  await prisma.gig.deleteMany({ where: { id: { in: gigIds } } }).catch(() => {});
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("S1 — moderation gate cannot be self-served", () => {
  it("a seller cannot resume their own PENDING_REVIEW gig into ACTIVE", async () => {
    const s = await seller();
    const g = await gig(s.id, "PENDING_REVIEW");

    await expect(resumeGig(g.id, s)).rejects.toThrow();

    const after = await prisma.gig.findUnique({ where: { id: g.id } });
    expect(after?.status, "must still be awaiting moderation").toBe("PENDING_REVIEW");
  });

  it("a seller cannot resume a DRAFT gig into ACTIVE either", async () => {
    const s = await seller();
    const g = await gig(s.id, "DRAFT");

    await expect(resumeGig(g.id, s)).rejects.toThrow();
    expect((await prisma.gig.findUnique({ where: { id: g.id } }))?.status).toBe("DRAFT");
  });

  it("pause then resume still works for an already-approved gig — the legitimate use", async () => {
    const s = await seller();
    const g = await gig(s.id, "ACTIVE");

    await pauseGig(g.id, s);
    expect((await prisma.gig.findUnique({ where: { id: g.id } }))?.status).toBe("PAUSED");

    await resumeGig(g.id, s);
    expect((await prisma.gig.findUnique({ where: { id: g.id } }))?.status).toBe("ACTIVE");
  });

  it("an admin can still move a gig live", async () => {
    const s = await seller();
    const g = await gig(s.id, "PENDING_REVIEW");
    const adminId = `p0_admin_${++seq}_${Date.now()}`;
    userIds.push(adminId);
    const admin = await prisma.user.create({
      data: { id: adminId, firstName: "Admin", username: adminId, role: "ADMIN", status: "ACTIVE", onboardingCompleted: true },
    });

    await resumeGig(g.id, admin);
    expect((await prisma.gig.findUnique({ where: { id: g.id } }))?.status).toBe("ACTIVE");
  });
});

describe("S3 — reputation cannot be manufactured from free test orders", () => {
  it("a test order cannot be reviewed", async () => {
    const s = await seller();
    const b = await buyer();
    const g = await gig(s.id, "ACTIVE");
    const o = await completedOrder(s.id, b.id, g.id, true);

    await expect(createReview(b.id, o.id, 5, "flawless, would buy again")).rejects.toThrow();
    expect(await prisma.review.count({ where: { orderId: o.id } })).toBe(0);
  });

  it("a real order can still be reviewed", async () => {
    const s = await seller();
    const b = await buyer();
    const g = await gig(s.id, "ACTIVE");
    const o = await completedOrder(s.id, b.id, g.id, false);

    await createReview(b.id, o.id, 5, "genuinely good work");
    expect(await prisma.review.count({ where: { orderId: o.id } })).toBe(1);
  });

  it("public review aggregates exclude any review attached to a test order", async () => {
    const s = await seller();
    const b = await buyer();
    const g = await gig(s.id, "ACTIVE");

    // A real 5-star review, and a test-order review forced straight into the DB to simulate
    // rows created before the createReview gate existed.
    const real = await completedOrder(s.id, b.id, g.id, false);
    await createReview(b.id, real.id, 5, "real");
    const fake = await completedOrder(s.id, b.id, g.id, true);
    await prisma.review.create({ data: { orderId: fake.id, gigId: g.id, authorId: b.id, rating: 5, comment: "farmed" } });

    const shown = await getGigReviews(g.id);
    const comments = shown.reviews.map((r) => r.comment);
    expect(comments, "the farmed review must not be public").not.toContain("farmed");
    expect(comments).toContain("real");
    expect(shown.count, "only the real review counts toward the public aggregate").toBe(1);
  });
});
