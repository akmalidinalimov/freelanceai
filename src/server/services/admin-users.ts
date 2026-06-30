import "server-only";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";

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
      createdAt: true,
      _count: { select: { ordersAsBuyer: true, ordersAsSeller: true, gigs: true } },
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
    orders: u._count.ordersAsBuyer,
    sales: u._count.ordersAsSeller,
    gigs: u._count.gigs,
    createdAt: u.createdAt,
  }));
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

/** Guard: admin-only, and never act on another admin or on yourself. */
async function loadTarget(admin: User, userId: string) {
  if (admin.role !== "ADMIN") throw Errors.forbidden("Admins only");
  if (admin.id === userId) throw Errors.forbidden("You cannot modify your own account here");
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
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
export function listPendingKyc() {
  return prisma.user.findMany({
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
