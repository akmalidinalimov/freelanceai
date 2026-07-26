import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, User } from "@prisma/client";
import { Errors, ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { decryptPII } from "@/lib/pii-crypto";
import { anonymizeAndClose } from "@/server/services/account";
import { sellerAvailableUzs } from "@/server/services/payments";
import { notifyAndPush } from "@/server/services/notification";

const displayName = (u: { firstName: string | null; name: string | null; username: string | null }) =>
  u.firstName ?? u.name ?? u.username ?? "";

export type AdminUserSegment = "all" | "buyers" | "sellers" | "pending" | "suspended";
export type AdminKycFilter = "NONE" | "PENDING" | "VERIFIED" | "REJECTED";

export interface AdminUserListParams {
  q?: string;
  segment?: AdminUserSegment;
  kyc?: AdminKycFilter;
  flagged?: boolean;
  page?: number; // 1-based
}

export const ADMIN_USERS_PAGE_SIZE = 50;

/** One shared WHERE builder so the list, the tab counts, and the CSV export can't drift. */
function adminUserWhere({ q, segment, kyc, flagged }: AdminUserListParams): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};
  const query = q?.trim();
  if (query) {
    where.OR = [
      { username: { contains: query, mode: "insensitive" } },
      { firstName: { contains: query, mode: "insensitive" } },
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { telegramId: { contains: query } },
    ];
  }
  if (segment === "buyers") {
    where.isSeller = false;
    where.role = { not: "ADMIN" };
  } else if (segment === "sellers") {
    where.isSeller = true;
  } else if (segment === "pending") {
    // The daily work queue: sellers waiting for storefront approval.
    where.sellerProfile = { is: { approvalStatus: "PENDING" } };
  } else if (segment === "suspended") {
    where.status = "SUSPENDED";
  }
  if (kyc) where.kycStatus = kyc;
  if (flagged) where.flags = { some: {} };
  return where;
}

const LIST_SELECT = {
  id: true,
  firstName: true,
  name: true,
  username: true,
  email: true,
  telegramId: true,
  role: true,
  isSeller: true,
  status: true,
  kycStatus: true,
  isCourseStudent: true,
  createdAt: true,
  lastLoginAt: true,
  lastSeenAt: true,
  telegramLastChatAt: true,
  sellerProfile: { select: { approvalStatus: true } },
  _count: {
    select: {
      ordersAsBuyer: true,
      ordersAsSeller: true,
      gigs: true,
      convosAsBuyer: true,
      convosAsSeller: true,
      messages: true,
      flags: true,
    },
  },
} satisfies Prisma.UserSelect;

function toListRow(u: Prisma.UserGetPayload<{ select: typeof LIST_SELECT }>) {
  return {
    id: u.id,
    name: displayName(u),
    username: u.username,
    email: u.email,
    telegramId: u.telegramId,
    role: u.role,
    isSeller: u.isSeller,
    approvalStatus: u.sellerProfile?.approvalStatus ?? null,
    status: u.status,
    kycStatus: u.kycStatus,
    isCourseStudent: u.isCourseStudent,
    orders: u._count.ordersAsBuyer,
    sales: u._count.ordersAsSeller,
    gigs: u._count.gigs,
    contacts: u._count.convosAsBuyer + u._count.convosAsSeller,
    messages: u._count.messages,
    flags: u._count.flags,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    lastSeenAt: u.lastSeenAt,
    telegramLastChatAt: u.telegramLastChatAt,
  };
}

/**
 * Admin: filterable, paginated user list + live tab counts. Search covers
 * username / name / email / Telegram id; segments mirror the marketplace roles
 * (buyers, sellers, pending approval, suspended).
 */
export async function listUsersForAdmin(params: AdminUserListParams = {}) {
  const where = adminUserWhere(params);
  const page = Math.max(1, params.page ?? 1);
  const [users, total, all, buyers, sellers, pending, suspended] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_USERS_PAGE_SIZE,
      take: ADMIN_USERS_PAGE_SIZE,
      select: LIST_SELECT,
    }),
    prisma.user.count({ where }),
    prisma.user.count(),
    prisma.user.count({ where: { isSeller: false, role: { not: "ADMIN" } } }),
    prisma.user.count({ where: { isSeller: true } }),
    prisma.user.count({ where: { sellerProfile: { is: { approvalStatus: "PENDING" } } } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
  ]);
  return {
    users: users.map(toListRow),
    total,
    page,
    pageSize: ADMIN_USERS_PAGE_SIZE,
    pages: Math.max(1, Math.ceil(total / ADMIN_USERS_PAGE_SIZE)),
    counts: { all, buyers, sellers, pending, suspended },
  };
}

/** Admin: the current filter's rows for CSV export (capped — an export is a snapshot, not a sync). */
export async function exportUsersForAdmin(params: AdminUserListParams = {}) {
  const users = await prisma.user.findMany({
    where: adminUserWhere(params),
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: LIST_SELECT,
  });
  return users.map(toListRow);
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
          id: true,
          approvalStatus: true,
          rejectionReason: true,
          headline: true,
          experienceYears: true,
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
    refundAgg,
    flags,
    gigsRecent,
    ordersAsBuyer,
    ordersAsSeller,
    payoutsRecent,
    clientBuyers,
    sellerCompleted,
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
    prisma.transaction.aggregate({
      where: { type: "REFUND", status: "SUCCEEDED", order: { buyerId: userId } },
      _sum: { amountUzs: true },
      _count: true,
    }),
    prisma.userFlag.findMany({ where: { userId }, orderBy: { severity: "desc" } }),
    prisma.gig.findMany({
      where: { sellerId: userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, title: true, slug: true, status: true, createdAt: true, _count: { select: { orders: true } } },
    }),
    prisma.order.findMany({
      where: { buyerId: userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, status: true, amountUzs: true, createdAt: true, gig: { select: { title: true } } },
    }),
    prisma.order.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, status: true, amountUzs: true, createdAt: true, gig: { select: { title: true } } },
    }),
    prisma.payoutRequest.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, amountUzs: true, status: true, createdAt: true },
    }),
    // Clients served + repeat rate: group this seller's orders by buyer.
    prisma.order.groupBy({
      by: ["buyerId"],
      where: { sellerId: userId },
      _count: true,
    }),
    prisma.order.aggregate({
      where: { sellerId: userId, status: "COMPLETED" },
      _count: true,
      _avg: { amountUzs: true },
    }),
  ]);

  const toMap = (groups: { status: string; _count: number }[]) =>
    Object.fromEntries(groups.map((g) => [g.status, g._count]));

  return {
    identity: {
      id: u.id,
      name: displayName(u),
      // Raw fields (not the display fallback) — the admin edit form needs the actual values.
      firstName: u.firstName,
      lastName: u.lastName,
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
      creditBalanceUzs: u.creditBalanceUzs,
    },
    buyer: {
      ordersByStatus: toMap(buyerByStatus as never),
      paidUzs: buyerPaidAgg._sum.amountUzs ?? 0,
      paidCount: buyerPaidAgg._count,
      contactsStarted: u._count.convosAsBuyer,
      lastOrderAt: lastBuyerOrder?.createdAt ?? null,
      lastContactAt: lastConvo?.createdAt ?? null,
      reviewsWritten: u._count.reviewsWritten,
      refundedUzs: refundAgg._sum.amountUzs ?? 0,
      refundedCount: refundAgg._count,
    },
    seller: u.isSeller
      ? {
          profile: u.sellerProfile,
          gigsTotal: u._count.gigs,
          gigsActive: activeGigs,
          // Marketplace performance: distinct clients, how many came back, and the
          // average completed order value — the numbers that describe a real seller.
          clientsServed: clientBuyers.length,
          repeatClients: clientBuyers.filter((c) => c._count > 1).length,
          completedOrders: sellerCompleted._count,
          avgOrderUzs: Math.round(sellerCompleted._avg.amountUzs ?? 0),
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
    flags,
    gigsRecent,
    ordersAsBuyer,
    ordersAsSeller,
    payoutsRecent,
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

/** Suspend or reactivate a user (never changes role; admin role stays allowlist-only).
 * The optional reason lands in the audit trail and rides the suspension notice. */
export async function setUserStatus(admin: User, userId: string, suspend: boolean, reason?: string) {
  await loadTarget(admin, userId);
  const trimmed = reason?.trim().slice(0, 500) || undefined;
  await prisma.user.update({ where: { id: userId }, data: { status: suspend ? "SUSPENDED" : "ACTIVE" } });
  await audit({
    actorId: admin.id,
    action: suspend ? "admin.user.suspend" : "admin.user.activate",
    entity: "User",
    entityId: userId,
    ...(trimmed ? { metadata: { reason: trimmed } } : {}),
  });
  if (suspend) {
    // Tell the user, with the reason when one was given — a silent lockout only breeds
    // support chats. Best-effort: notification failure never blocks the suspension.
    await notifyAndPush(userId, "account.suspended", "Hisobingiz vaqtincha toʻxtatildi", {
      body: trimmed ? `Sabab: ${trimmed}` : "Batafsil maʼlumot uchun qoʻllab-quvvatlashga yozing.",
    }).catch(() => {});
  }
}

/** Cap on a single admin credit adjustment (UZS, either direction). */
const CREDIT_ADJUST_MAX_UZS = 10_000_000;

/**
 * Admin support lever: grant (or claw back) promo/referral credit with a mandatory
 * reason. Balance can never go negative; every adjustment is audited with the delta,
 * reason, and resulting balance. Positive deltas notify the user.
 */
export async function adjustUserCredit(admin: User, userId: string, deltaUzs: number, reason: string) {
  await loadTarget(admin, userId);
  const delta = Math.trunc(deltaUzs);
  const why = reason.trim();
  if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > CREDIT_ADJUST_MAX_UZS) {
    throw Errors.validation({ amountUzs: `Must be a non-zero amount up to ${CREDIT_ADJUST_MAX_UZS}` });
  }
  if (why.length < 3) throw Errors.validation({ reason: "A reason is required" });

  const newBalance = await prisma.$transaction(async (tx) => {
    const row = await tx.user.findUnique({ where: { id: userId }, select: { creditBalanceUzs: true } });
    if (!row) throw Errors.notFound("User not found");
    const next = row.creditBalanceUzs + delta;
    if (next < 0) throw Errors.validation({ amountUzs: `Balance would go negative (current ${row.creditBalanceUzs})` });
    await tx.user.update({ where: { id: userId }, data: { creditBalanceUzs: next } });
    return next;
  });
  await audit({
    actorId: admin.id,
    action: "admin.user.credit_adjust",
    entity: "User",
    entityId: userId,
    metadata: { deltaUzs: delta, reason: why, newBalanceUzs: newBalance },
  });
  if (delta > 0) {
    await notifyAndPush(userId, "credit.granted", `🎁 Hisobingizga ${delta.toLocaleString("uz-UZ")} soʻm kredit qoʻshildi`, {
      body: "Keyingi buyurtmangizda avtomatik qoʻllanadi.",
    }).catch(() => {});
  }
  return newBalance;
}

/**
 * Admin edits a user's identity fields. Deliberately excludes the AUTH identities
 * (email, telegramId): those are login credentials, so changing them would silently
 * transfer account access — support edits go through impersonation instead, which is
 * time-boxed and audited. Username uniqueness is enforced (it's the public storefront
 * handle, gigora.ai/@username).
 */
export async function updateUserIdentity(
  admin: User,
  userId: string,
  input: { firstName?: string; lastName?: string | null; username?: string | null; locale?: string }
) {
  await loadTarget(admin, userId);
  const data: Record<string, unknown> = {};

  if (input.firstName !== undefined) {
    const v = input.firstName.trim().slice(0, 60);
    if (!v) throw Errors.validation({ firstName: "First name cannot be empty" });
    data.firstName = v;
  }
  if (input.lastName !== undefined) data.lastName = input.lastName?.trim().slice(0, 60) || null;
  if (input.username !== undefined) {
    const raw = input.username?.trim().replace(/^@/, "").toLowerCase() ?? "";
    if (!raw) data.username = null;
    else {
      if (!/^[a-z0-9_]{3,32}$/.test(raw)) {
        throw Errors.validation({ username: "3-32 chars: a-z, 0-9, underscore" });
      }
      const taken = await prisma.user.findFirst({
        where: { username: raw, id: { not: userId } },
        select: { id: true },
      });
      if (taken) throw Errors.validation({ username: "Already taken" });
      data.username = raw;
    }
  }
  if (input.locale !== undefined) {
    if (!["uz", "ru", "en"].includes(input.locale)) throw Errors.validation({ locale: "uz | ru | en" });
    data.locale = input.locale;
  }
  if (Object.keys(data).length === 0) return;

  await prisma.user.update({ where: { id: userId }, data });
  await audit({
    actorId: admin.id,
    action: "admin.user.update_identity",
    entity: "User",
    entityId: userId,
    metadata: { fields: Object.keys(data) },
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

export type BulkUserAction =
  | "suspend"
  | "unsuspend"
  | "makeSeller"
  | "removeSeller"
  | "creditGrant"
  | "tagCourse"
  | "untagCourse";

/** Hard cap per bulk request — keeps one click from touching the whole user base. */
const BULK_MAX = 200;

/**
 * Apply one action to many users. Routes every user through the SAME single-user
 * service functions, so all guards (never an admin, never yourself), audit rows, and
 * user notifications behave identically to acting one-by-one. Sequential on purpose:
 * these are support batches, not a migration, and it keeps the DB calm.
 *
 * Deliberately NOT bulk-able: account deletion (irreversible, needs typed
 * confirmation per user) and KYC approval (each one needs its phone reviewed).
 */
export async function bulkUserAction(
  admin: User,
  userIds: string[],
  action: BulkUserAction,
  opts: { reason?: string; amountUzs?: number } = {}
): Promise<{ done: number; skipped: number; failed: number }> {
  if (admin.role !== "ADMIN") throw Errors.forbidden("Admins only");
  const ids = Array.from(new Set(userIds)).slice(0, BULK_MAX);
  if (ids.length === 0) throw Errors.validation({ userIds: "Select at least one user" });
  if (action === "suspend" && !opts.reason?.trim()) {
    throw Errors.validation({ reason: "A reason is required to suspend" });
  }
  if (action === "creditGrant") {
    if (!opts.amountUzs || opts.amountUzs <= 0) throw Errors.validation({ amountUzs: "Amount is required" });
    if (!opts.reason?.trim()) throw Errors.validation({ reason: "A reason is required" });
  }

  let done = 0;
  let skipped = 0;
  let failed = 0;
  for (const id of ids) {
    // Admins and self are skipped, not errors — selecting a whole page shouldn't fail.
    if (id === admin.id) {
      skipped += 1;
      continue;
    }
    try {
      if (action === "suspend") await setUserStatus(admin, id, true, opts.reason);
      else if (action === "unsuspend") await setUserStatus(admin, id, false);
      else if (action === "makeSeller") await setUserSeller(admin, id, true);
      else if (action === "removeSeller") await setUserSeller(admin, id, false);
      else if (action === "tagCourse" || action === "untagCourse")
        await setCourseStudent(admin, id, action === "tagCourse");
      else await adjustUserCredit(admin, id, opts.amountUzs!, opts.reason!);
      done += 1;
    } catch (err) {
      // "Cannot modify an admin" / "not found" are skips; anything else is a failure.
      if (err instanceof ApiError && (err.code === "FORBIDDEN" || err.code === "NOT_FOUND")) skipped += 1;
      else failed += 1;
    }
  }
  await audit({
    actorId: admin.id,
    action: `admin.users.bulk.${action}`,
    entity: "User",
    metadata: { requested: ids.length, done, skipped, failed, ...(opts.reason ? { reason: opts.reason } : {}) },
  });
  return { done, skipped, failed };
}

/** Tag/untag a user as an AI CREATORS course graduate (featured ranking + badge). */
export async function setCourseStudent(admin: User, userId: string, isCourseStudent: boolean) {
  await loadTarget(admin, userId);
  await prisma.user.update({ where: { id: userId }, data: { isCourseStudent } });
  await audit({
    actorId: admin.id,
    action: isCourseStudent ? "admin.user.tag_course" : "admin.user.untag_course",
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
