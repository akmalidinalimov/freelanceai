import "server-only";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";
import { notifyAndPush, notifyAdmins } from "@/server/services/notification";
import { SPECIALIZATIONS } from "@/lib/specializations";

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

/**
 * Draft the storefront profile from a just-created gig so the seller never types the same
 * thing twice: gig title → headline, gig description → bio, gig tags/category → specializations.
 * ONLY fills blanks — never overwrites anything the seller wrote. The seller can edit every
 * drafted field on the profile page. Best-effort: a failure never breaks gig creation.
 */
export async function autoDraftSellerProfile(
  userId: string,
  gig: { title: string; description: string; tags: string[]; categoryId: string | null }
): Promise<void> {
  try {
    const profile = await prisma.sellerProfile.findUnique({
      where: { userId },
      select: { headline: true, bio: true, specializations: true },
    });
    if (!profile) return;
    const needHeadline = !profile.headline?.trim();
    const needBio = !profile.bio?.trim();
    const needSpecs = (profile.specializations?.length ?? 0) === 0;
    if (!needHeadline && !needBio && !needSpecs) return;

    let specs: string[] = [];
    if (needSpecs) {
      // Exact-term set: gig tags (stored lowercased) + category names/slug.
      const terms = new Set(gig.tags.map((t) => t.toLowerCase()));
      if (gig.categoryId) {
        const cat = await prisma.category.findUnique({
          where: { id: gig.categoryId },
          select: { slug: true, nameUz: true, nameRu: true, nameEn: true },
        });
        for (const s of [cat?.slug, cat?.nameUz, cat?.nameRu, cat?.nameEn]) {
          if (s) terms.add(s.toLowerCase());
        }
      }
      // Also mine the gig's own words: the no-AI template path produces no tags at all,
      // which used to leave specializations empty — the one approval-checklist item a
      // one-sentence gig couldn't complete. Word-boundary tokens (not substrings), so
      // "start" never matches the synonym "art"; multi-word synonyms match as phrases.
      const text = `${gig.title} ${gig.description}`.toLowerCase();
      const words = new Set(text.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3));
      const specMatches = (label: string): boolean => {
        const l = label.toLowerCase();
        if (terms.has(l)) return true;
        if (l.includes(" ") || l.includes("-")) return text.includes(l);
        return l.length >= 3 && words.has(l);
      };
      specs = SPECIALIZATIONS.filter((s) => [s.key, s.uz, s.ru, s.en, ...s.synonyms].some(specMatches))
        .map((s) => s.key)
        .slice(0, 5);
    }

    const data: Record<string, unknown> = {
      ...(needHeadline && gig.title.trim() ? { headline: gig.title.trim().slice(0, 120) } : {}),
      ...(needBio && gig.description.trim() ? { bio: gig.description.trim().slice(0, 600) } : {}),
      ...(needSpecs && specs.length ? { specializations: specs } : {}),
    };
    if (Object.keys(data).length === 0) return;
    await prisma.sellerProfile.update({ where: { userId }, data });
  } catch {
    // best-effort — a failed auto-draft never breaks gig creation
  }
}

/**
 * One-time nudge the moment a seller becomes eligible to submit (profile + first gig done), so
 * they don't have to notice the dashboard banner. Call best-effort after any step that could
 * complete eligibility (gig create, profile save). Idempotent via an ActivityEvent; never throws.
 */
export async function nudgeIfReadyToSubmit(userId: string): Promise<void> {
  try {
    const state = await getApprovalState(userId);
    if (!state.canSubmit || state.status !== "INCOMPLETE") return;
    const already = await prisma.activityEvent.findFirst({
      where: { type: "seller_ready_nudge", entityId: userId },
      select: { id: true },
    });
    if (already) return;
    await notifyAndPush(userId, "seller.ready", "🎉 Hammasi tayyor — tekshiruvga yuboring", {
      body: "Profil va e'loningiz tayyor. Bitta tugma bilan sotuvchi profilini faollashtirish uchun yuboring.",
      link: "/dashboard/seller",
    }).catch(() => {});
    await prisma.activityEvent
      .create({ data: { userId, type: "seller_ready_nudge", entityId: userId } })
      .catch(() => {});
  } catch {
    // best-effort — a missed nudge never breaks the action that triggered it
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Warn sellers ~24h BEFORE their unsubmitted-grace expires, so the revoke is never silent.
 * Targets INCOMPLETE + never-submitted profiles created between (grace−1) and grace days ago.
 * Idempotent via an ActivityEvent so a daily cron re-run can't double-notify. Returns the count.
 */
export async function warnExpiringSellers(): Promise<number> {
  const now = Date.now();
  const warnAfter = new Date(now - (UNSUBMITTED_GRACE_DAYS - 1) * DAY_MS); // older than grace−1 day
  const cutoff = new Date(now - UNSUBMITTED_GRACE_DAYS * DAY_MS); // not yet past the full grace
  const soon = await prisma.sellerProfile.findMany({
    where: { approvalStatus: "INCOMPLETE", submittedAt: null, createdAt: { lt: warnAfter, gte: cutoff } },
    select: { userId: true },
  });
  let warned = 0;
  for (const s of soon) {
    const already = await prisma.activityEvent.findFirst({
      where: { type: "seller_expiry_warn", entityId: s.userId },
      select: { id: true },
    });
    if (already) continue;
    await notifyAndPush(s.userId, "seller.expiry_warn", "⏳ Sotuvchi profilingiz tez orada o'chiriladi", {
      body: "Profilni tekshiruvga yuboring — aks holda ertaga sotuvchi ruxsati bekor qilinadi.",
      link: "/dashboard/seller",
    }).catch(() => {});
    await prisma.activityEvent
      .create({ data: { userId: s.userId, type: "seller_expiry_warn", entityId: s.userId } })
      .catch(() => {});
    warned += 1;
  }
  return warned;
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
