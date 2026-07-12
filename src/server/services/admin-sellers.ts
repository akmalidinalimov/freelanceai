import "server-only";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";
import { notifyAndPush } from "@/server/services/notification";

/**
 * Admin side of the seller approval flow. Lists PENDING sellers and lets an admin
 * APPROVE (→ APPROVED, seller + gigs go public) or REJECT (→ REJECTED, seller can
 * edit and resubmit). Every action is audited.
 */

const displayName = (u: { firstName: string | null; name: string | null; username: string | null }) =>
  u.firstName ?? u.name ?? u.username ?? "";

export interface PendingSeller {
  profileId: string;
  userId: string;
  name: string;
  username: string | null;
  email: string | null;
  headline: string | null;
  bio: string | null;
  specializations: string[];
  gigCount: number;
  submittedAt: Date | null;
}

/** Sellers awaiting approval, newest submission first. */
export async function listPendingSellers(): Promise<PendingSeller[]> {
  const rows = await prisma.sellerProfile.findMany({
    where: { approvalStatus: "PENDING" },
    orderBy: { submittedAt: "desc" },
    take: 100,
    select: {
      id: true,
      userId: true,
      headline: true,
      bio: true,
      specializations: true,
      submittedAt: true,
      user: { select: { firstName: true, name: true, username: true, email: true } },
    },
  });

  const counts = await prisma.gig.groupBy({
    by: ["sellerId"],
    where: { sellerId: { in: rows.map((r) => r.userId) }, deletedAt: null },
    _count: true,
  });
  const gigCountBy = new Map(counts.map((c) => [c.sellerId, c._count]));

  return rows.map((r) => ({
    profileId: r.id,
    userId: r.userId,
    name: displayName(r.user),
    username: r.user.username,
    email: r.user.email,
    headline: r.headline,
    bio: r.bio,
    specializations: r.specializations,
    gigCount: gigCountBy.get(r.userId) ?? 0,
    submittedAt: r.submittedAt,
  }));
}

/** Guard: admin-only, and the target profile must currently be PENDING. */
async function loadPending(admin: User, profileId: string) {
  if (admin.role !== "ADMIN") throw Errors.forbidden("Admins only");
  const profile = await prisma.sellerProfile.findUnique({
    where: { id: profileId },
    select: { id: true, userId: true, approvalStatus: true },
  });
  if (!profile) throw Errors.notFound("Seller not found");
  if (profile.approvalStatus !== "PENDING") throw Errors.conflict("Seller is not pending review");
  return profile;
}

/** Approve a pending seller — they and their gigs become publicly visible. */
export async function approveSeller(admin: User, profileId: string) {
  const profile = await loadPending(admin, profileId);
  await prisma.sellerProfile.update({
    where: { id: profileId },
    data: { approvalStatus: "APPROVED", approvedAt: new Date(), reviewedById: admin.id, rejectionReason: null },
  });
  await audit({ actorId: admin.id, action: "seller.approve", entity: "SellerProfile", entityId: profileId });
  await notifyAndPush(profile.userId, "seller.approved", "Profilingiz tasdiqlandi", {
    body: "Tabriklaymiz! Profilingiz va xizmatlaringiz endi omma uchun koʻrinadi.",
    link: "/dashboard/seller",
  }).catch(() => {});
}

/** Reject a pending seller with a reason — they may edit and resubmit. */
export async function rejectSeller(admin: User, profileId: string, reason: string) {
  const profile = await loadPending(admin, profileId);
  const clean = reason.trim().slice(0, 500);
  if (!clean) throw Errors.validation({ reason: "required" }, "A rejection reason is required");
  await prisma.sellerProfile.update({
    where: { id: profileId },
    data: { approvalStatus: "REJECTED", reviewedById: admin.id, rejectionReason: clean },
  });
  await audit({ actorId: admin.id, action: "seller.reject", entity: "SellerProfile", entityId: profileId });
  await notifyAndPush(profile.userId, "seller.rejected", "Profil tasdiqlanmadi", {
    body: clean,
    link: "/dashboard/seller",
  }).catch(() => {});
}
