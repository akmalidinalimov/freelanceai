import "server-only";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";
import { notifyAndPush, notifyAdmins } from "@/server/services/notification";

/**
 * Seller approval flow (2026-07-09). A new seller is INCOMPLETE: they can build a
 * profile and create gigs, but neither they nor their gigs appear on any public
 * surface until an admin APPROVES them (see seller-visibility.ts for the gate).
 *
 * Submit requires a real storefront: headline + bio + ≥1 specialization + ≥1 gig
 * (any status). On submit → PENDING. A REJECTED seller may edit and resubmit.
 */

/** Days a never-submitted INCOMPLETE seller is kept before the seller capability is revoked. */
const UNSUBMITTED_GRACE_DAYS = 3;

export type ApprovalMissing = "headline" | "bio" | "specialization" | "gig";

export interface ApprovalState {
  status: "INCOMPLETE" | "PENDING" | "APPROVED" | "REJECTED";
  canSubmit: boolean;
  missing: ApprovalMissing[];
  rejectionReason: string | null;
}

/** Compute what (if anything) a seller still needs before they can submit for approval. */
export async function getApprovalState(userId: string): Promise<ApprovalState> {
  const [profile, gigCount] = await Promise.all([
    prisma.sellerProfile.findUnique({
      where: { userId },
      select: { approvalStatus: true, headline: true, bio: true, specializations: true, rejectionReason: true },
    }),
    // Any gig counts (draft/pending/active) — the seller has done real setup work.
    prisma.gig.count({ where: { sellerId: userId, deletedAt: null } }),
  ]);

  const missing: ApprovalMissing[] = [];
  if (!profile?.headline?.trim()) missing.push("headline");
  if (!profile?.bio?.trim()) missing.push("bio");
  if ((profile?.specializations?.length ?? 0) === 0) missing.push("specialization");
  if (gigCount === 0) missing.push("gig");

  const status = profile?.approvalStatus ?? "INCOMPLETE";
  // Only INCOMPLETE / REJECTED sellers can (re)submit; PENDING is under review, APPROVED is done.
  const canSubmit = missing.length === 0 && (status === "INCOMPLETE" || status === "REJECTED");

  return { status, canSubmit, missing, rejectionReason: profile?.rejectionReason ?? null };
}

/** Submit the caller's seller profile for admin approval. Validates completeness. */
export async function submitForApproval(userId: string): Promise<ApprovalState> {
  const state = await getApprovalState(userId);
  if (state.status === "PENDING") throw Errors.conflict("Already under review");
  if (state.status === "APPROVED") throw Errors.conflict("Already approved");
  if (state.missing.length > 0) {
    throw Errors.validation(
      Object.fromEntries(state.missing.map((m) => [m, "required"])),
      "Complete your profile before submitting"
    );
  }

  await prisma.sellerProfile.update({
    where: { userId },
    data: { approvalStatus: "PENDING", submittedAt: new Date(), rejectionReason: null },
  });
  await audit({ actorId: userId, action: "seller.submit_for_approval", entity: "SellerProfile", entityId: userId });
  // Nudge admins to review (best-effort — never blocks the submit).
  await notifyAdmins("admin.seller_review", "🆕 Yangi sotuvchi tasdiqlash uchun", {
    body: "Yangi ijodkor profili tekshiruvda.",
    link: "/admin/sellers",
  }).catch(() => {});

  return { status: "PENDING", canSubmit: false, missing: [], rejectionReason: null };
}

/** Auto-revoke the seller capability from sellers who never completed onboarding.
 * INCOMPLETE + never submitted + profile older than the grace window → drop isSeller and
 * delete the empty SellerProfile. The user KEEPS their account (they stay a buyer). */
export async function expireUnsubmittedSellers(): Promise<number> {
  const cutoff = new Date(Date.now() - UNSUBMITTED_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const stale = await prisma.sellerProfile.findMany({
    where: { approvalStatus: "INCOMPLETE", submittedAt: null, createdAt: { lt: cutoff } },
    select: { id: true, userId: true },
  });

  let revoked = 0;
  for (const s of stale) {
    try {
      await prisma.$transaction([
        prisma.user.update({ where: { id: s.userId }, data: { isSeller: false } }),
        prisma.sellerProfile.delete({ where: { id: s.id } }),
      ]);
      await audit({ action: "seller.auto_revoked", entity: "User", entityId: s.userId });
      revoked += 1;
    } catch (err) {
      console.error("expireUnsubmittedSellers: revoke failed", { userId: s.userId, err });
    }
  }
  return revoked;
}
