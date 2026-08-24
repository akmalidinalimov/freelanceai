/**
 * Bulk account deletion INTEGRATION tests — real Postgres, because the guards being proved are
 * DB-level (an order-status count inside a serializable transaction, and an aggregate balance
 * read). Run by the `integration` CI job, or locally via `npm run test:integration`.
 *
 * Deletion is anonymize-and-close, so "deleted" means: identifiers stripped, status DELETED,
 * orders/ledger intact. What must never regress is the refusal path — someone with a live order
 * or an unwithdrawn balance must come back as SKIPPED, never destroyed mid-transaction, even
 * when the action arrives as part of a batch.
 */
import { describe, it, expect, afterAll } from "vitest";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bulkUserAction } from "@/server/services/admin-users";

let seq = 0;
const ids: string[] = [];

async function makeAdmin(): Promise<User> {
  const id = `bd_admin_${++seq}_${Date.now()}`;
  ids.push(id);
  return prisma.user.create({
    data: { id, firstName: "Admin", username: id, role: "ADMIN", status: "ACTIVE", onboardingCompleted: true },
  });
}

/** A plain buyer with no history — nothing blocks their deletion. */
async function makePlainUser(): Promise<string> {
  const id = `bd_user_${++seq}_${Date.now()}`;
  ids.push(id);
  await prisma.user.create({
    data: { id, firstName: "Plain", username: id, role: "BUYER", status: "ACTIVE", onboardingCompleted: true },
  });
  return id;
}

/** A buyer holding a live order — deletion must refuse. */
async function makeUserWithLiveOrder(): Promise<string> {
  const n = ++seq;
  const buyerId = `bd_busy_${n}_${Date.now()}`;
  const sellerId = `bd_sell_${n}_${Date.now()}`;
  ids.push(buyerId, sellerId);
  await prisma.user.create({
    data: { id: buyerId, firstName: "Busy", username: buyerId, role: "BUYER", status: "ACTIVE", onboardingCompleted: true },
  });
  await prisma.user.create({
    data: { id: sellerId, firstName: "Seller", username: sellerId, isSeller: true, role: "BUYER", status: "ACTIVE", onboardingCompleted: true },
  });
  const gig = await prisma.gig.create({
    data: { sellerId, title: `bd gig ${n}`, slug: `bd-gig-${n}-${Date.now()}`, description: "bulk delete test gig", status: "ACTIVE", locale: "uz" },
  });
  await prisma.order.create({
    data: {
      gigId: gig.id, buyerId, sellerId, packageTier: "BASIC", packageTitle: "Basic",
      amountUzs: 100_000, sellerNetUzs: 80_000, status: "IN_PROGRESS",
    },
  });
  return buyerId;
}

afterAll(async () => {
  await prisma.order.deleteMany({ where: { OR: [{ buyerId: { in: ids } }, { sellerId: { in: ids } }] } }).catch(() => {});
  await prisma.gig.deleteMany({ where: { sellerId: { in: ids } } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }).catch(() => {});
  await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await prisma.$disconnect();
});

describe("bulk delete", () => {
  it("closes a plain account: identifiers stripped, status DELETED", async () => {
    const admin = await makeAdmin();
    const id = await makePlainUser();

    const res = await bulkUserAction(admin, [id], "delete");
    expect(res).toMatchObject({ done: 1, skipped: 0, failed: 0 });

    const after = await prisma.user.findUnique({ where: { id } });
    expect(after?.status).toBe("DELETED");
    expect(after?.firstName).toBeNull();
    expect(after?.username).toBeNull();
    expect(after?.telegramId).toBeNull();
  });

  it("refuses a user holding a live order — skipped, and the account is untouched", async () => {
    const admin = await makeAdmin();
    const busy = await makeUserWithLiveOrder();

    const res = await bulkUserAction(admin, [busy], "delete");
    expect(res).toMatchObject({ done: 0, skipped: 1, failed: 0 });

    const after = await prisma.user.findUnique({ where: { id: busy } });
    expect(after?.status, "still usable — someone is mid-transaction with them").toBe("ACTIVE");
    expect(after?.firstName).toBe("Busy");
  });

  it("a mixed batch deletes what it can and skips the rest (one bad row can't block the batch)", async () => {
    const admin = await makeAdmin();
    const plain = await makePlainUser();
    const busy = await makeUserWithLiveOrder();

    const res = await bulkUserAction(admin, [plain, busy], "delete");
    expect(res).toMatchObject({ done: 1, skipped: 1, failed: 0 });
    expect((await prisma.user.findUnique({ where: { id: plain } }))?.status).toBe("DELETED");
    expect((await prisma.user.findUnique({ where: { id: busy } }))?.status).toBe("ACTIVE");
  });

  it("never deletes another admin, and never the caller", async () => {
    const admin = await makeAdmin();
    const other = await makeAdmin();

    const res = await bulkUserAction(admin, [other.id, admin.id], "delete");
    expect(res).toMatchObject({ done: 0, skipped: 2, failed: 0 });
    expect((await prisma.user.findUnique({ where: { id: other.id } }))?.status).toBe("ACTIVE");
    expect((await prisma.user.findUnique({ where: { id: admin.id } }))?.status).toBe("ACTIVE");
  });
});
