import "server-only";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";
import { decryptPII } from "@/lib/pii-crypto";
import { anonymizeAndClose } from "@/server/services/account";
import { sellerAvailableUzs } from "@/server/services/payments";

const displayName = (u: { firstName: string | null; name: string | null; username: string | null }) =>
  u.firstName ?? u.name ?? u.username ?? "";

/** Admin: list users (optional search over username / name / email), newest first. */
export async function listUsersForAdmin(query?: string) {
  const q = query?.trim();
  const where = q
    ? {
        OR: [
          { username: { contains: q, mode: "insensitive" as const } },
          { firstName: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      firstName: true,
      name: true,
      username: true,
      email: true,
      role: true,
      isSeller: true,
      status: true,
      kycStatus: true,
      createdAt: true,
      lastLoginAt: true,
      lastSeenAt: true,
      telegramLastChatAt: true,
      _count: {
        select: {
          ordersAsBuyer: true,
          ordersAsSeller: true,
          gigs: true,
          convosAsBuyer: true,
          convosAsSeller: true,
          messages: true,
        },
      },
    },
  });
  return users.map((u) => ({
    id: u.id,
    name: displayName(u),
    username: u.username,
    email: u.email,
    role: u.role,
    isSeller: u.isSeller,
    status: u.status,
    kycStatus: u.kycStatus,
    orders: u._count.ordersAsBuyer,
    sales: u._count.ordersAsSeller,
    gigs: u._count.gigs,
    contacts: u._count.convosAsBuyer + u._count.convosAsSeller,
    messages: u._count.messages,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    lastSeenAt: u.lastSeenAt,
    telegramLastChatAt: u.telegramLastChatAt,
  }));
}

/**
 * Admin: the full per-user dossier — identity, buyer stats, seller stats, money state,
 * and recent activity. Phone decrypted only here (admin review boundary).
 */
export async function getUserDetailForAdmin(admin: User, userId: string) {
  if (admin.role !== "ADMIN") throw Errors.forbidden("Admins only");
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      sellerProfile: {
        select: {
          headline: true,
          level: true,
          ratingAvg: true,
          ratingCount: true,
          specializations: true,
          instagramUsername: true,
          instagramSyncedAt: true,
        },
      },
      _count: {
        select: {
          gigs: true,
          convosAsBuyer: true,
          convosAsSeller: true,
          messages: true,
          reviewsWritten: true,
          referrals: true,
        },
      },
    },
  });
  if (!u) throw Errors.notFound("User not found");

  const [
    buyerByStatus,
    sellerByStatus,
    buyerPaidAgg,
    sellerEarnedAgg,
    payoutsPaidAgg,
    payoutsPendingAgg,
    lastBuyerOrder,
    lastConvo,
    activeGigs,
    recentEvents,
    recentAudit,
    balance,
  ] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], where: { buyerId: userId }, _count: true }),
    prisma.order.groupBy({ by: ["status"], where: { sellerId: userId }, _count: true }),
    // What the buyer actually paid: succeeded PAYMENT_IN transactions on their orders.
    prisma.transaction.aggregate({
      where: { type: "PAYMENT_IN", status: "SUCCEEDED", order: { buyerId: userId } },
      _sum: { amountUzs: true },
      _count: true,
    }),
    prisma.order.aggregate({ where: { sellerId: userId, status: "COMPLETED" }, _sum: { sellerNetUzs: true } }),
    prisma.payoutRequest.aggregate({ where: { sellerId: userId, status: "PAID" }, _sum: { amountUzs: true }, _count: true }),
    prisma.payoutRequest.aggregate({ where: { sellerId: userId, status: "REQUESTED" }, _sum: { amountUzs: true }, _count: true }),
    prisma.order.findFirst({ where: { buyerId: userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.conversation.findFirst({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.gig.count({ where: { sellerId: userId, status: "ACTIVE", deletedAt: null } }),
    prisma.activityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { type: true, entityId: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { actorId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { action: true, entity: true, entityId: true, createdAt: true },
    }),
    u.isSeller ? sellerAvailableUzs(userId) : Promise.resolve(0),
  ]);

  const toMap = (groups: { status: string; _count: number }[]) =>
    Object.fromEntries(groups.map((g) => [g.status, g._count]));

  return {
    identity: {
      id: u.id,
      name: displayName(u),
      username: u.username,
      email: u.email,
      telegramId: u.telegramId,
      phone: decryptPII(u.phone), // admin boundary — decrypted for review only
      locale: u.locale,
      role: u.role,
      isSeller: u.isSeller,
      status: u.status,
      kycStatus: u.kycStatus,
      payoutCardMasked: u.payoutCardMasked,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      lastSeenAt: u.lastSeenAt,
      telegramLastChatAt: u.telegramLastChatAt,
      referrals: u._count.referrals,
    },
    buyer: {
      ordersByStatus: toMap(buyerByStatus as never),
      paidUzs: buyerPaidAgg._sum.amountUzs ?? 0,
      paidCount: buyerPaidAgg._count,
      contactsStarted: u._count.convosAsBuyer,
      lastOrderAt: lastBuyerOrder?.createdAt ?? null,
      lastContactAt: lastConvo?.createdAt ?? null,
      reviewsWritten: u._count.reviewsWritten,
    },
    seller: u.isSeller
      ? {
          profile: u.sellerProfile,
          gigsTotal: u._count.gigs,
          gigsActive: activeGigs,
          ordersByStatus: toMap(sellerByStatus as never),
          lifetimeEarnedUzs: sellerEarnedAgg._sum.sellerNetUzs ?? 0,
          availableUzs: balance,
          payoutsPaidUzs: payoutsPaidAgg._sum.amountUzs ?? 0,
          payoutsPaidCount: payoutsPaidAgg._count,
          payoutsPendingUzs: payoutsPendingAgg._sum.amountUzs ?? 0,
          payoutsPendingCount: payoutsPendingAgg._count,
          conversations: u._count.convosAsSeller,
        }
      : null,
    messagesSent: u._count.messages,
    recentEvents,
    recentAudit,
  };
}

/**
 * Admin deletes (anonymizes-and-closes) a user account. Same data-integrity guards as
 * self-deletion (no active orders, no withdrawable balance). Never targets admins or
 * yourself (loadTarget). Role stays untouchable: ADMIN is allowlist-only by design.
 */
export async function adminDeleteUser(admin: User, userId: string) {
  const target = await loadTarget(admin, userId); // same row the role check validated
  await anonymizeAndClose(target, admin.id, "admin.user.delete");
}

/** Admin: recent audit-log entries, optionally filtered by action substring. */
export async function listAuditLogs(action?: string) {
  const a = action?.trim();
  const logs = await prisma.auditLog.findMany({
    where: a ? { action: { contains: a, mode: "insensitive" } } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { firstName: true, name: true, username: true } } },
  });
  return logs.map((l) => ({
    id: l.id,
    actor: l.actor ? displayName(l.actor) : "system",
    action: l.action,
    entity: l.entity,
    entityId: l.entityId,
    createdAt: l.createdAt,
  }));
}

/** Guard: admin-only, and never act on another admin or on yourself. Returns the full
 * target row so callers act on the SAME row the role check saw (no re-fetch gap). */
async function loadTarget(admin: User, userId: string): Promise<User> {
  if (admin.role !== "ADMIN") throw Errors.forbidden("Admins only");
  if (admin.id === userId) throw Errors.forbidden("You cannot modify your own account here");
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw Errors.notFound("User not found");
  if (target.role === "ADMIN") throw Errors.forbidden("Cannot modify an admin");
  return target;
}

/** Suspend or reactivate a user (never changes role; admin role stays allowlist-only). */
export async function setUserStatus(admin: User, userId: string, suspend: boolean) {
  await loadTarget(admin, userId);
  await prisma.user.update({ where: { id: userId }, data: { status: suspend ? "SUSPENDED" : "ACTIVE" } });
  await audit({
    actorId: admin.id,
    action: suspend ? "admin.user.suspend" : "admin.user.activate",
    entity: "User",
    entityId: userId,
  });
}

/** Toggle a user's seller capability. */
export async function setUserSeller(admin: User, userId: string, isSeller: boolean) {
  await loadTarget(admin, userId);
  await prisma.user.update({ where: { id: userId }, data: { isSeller } });
  await audit({
    actorId: admin.id,
    action: isSeller ? "admin.user.makeSeller" : "admin.user.removeSeller",
    entity: "User",
    entityId: userId,
  });
}

/** Users awaiting KYC review (phone captured → kycStatus PENDING). */
export async function listPendingKyc() {
  const rows = await prisma.user.findMany({
    where: { kycStatus: "PENDING" },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      firstName: true,
      name: true,
      username: true,
      telegramId: true,
      phone: true,
      isSeller: true,
      payoutCardMasked: true,
    },
  });
  // Phone is encrypted at rest; decrypt only here, at the admin review boundary.
  return rows.map((r) => ({ ...r, phone: decryptPII(r.phone) }));
}

/** Approve or reject a user's KYC. */
export async function setUserKyc(admin: User, userId: string, status: "VERIFIED" | "REJECTED") {
  await loadTarget(admin, userId);
  await prisma.user.update({ where: { id: userId }, data: { kycStatus: status } });
  await audit({
    actorId: admin.id,
    action: status === "VERIFIED" ? "admin.kyc.approve" : "admin.kyc.reject",
    entity: "User",
    entityId: userId,
  });
}
