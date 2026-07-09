import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma, User } from "@prisma/client";
import { uniqueSlug } from "@/lib/slug";
import { audit } from "@/lib/audit";
import { stripContactInfo } from "@/lib/sanitize";
import { Errors } from "@/lib/api";
import { gigEditWhereForUser } from "@/lib/authz";
import { notifyFollowersOfNewGig } from "@/server/services/follow";
import { notifyAndPush, notifyAdmins } from "@/server/services/notification";
import { adminGigReviewButtons } from "@/lib/telegram-bot";
import { PUBLIC_GIG_SELLER } from "@/server/services/seller-visibility";

export type GigSort = "newest" | "price_asc" | "price_desc" | "popular";
export interface GigFilters {
  q?: string;
  categorySlug?: string;
  minUzs?: number;
  maxUzs?: number;
  sort?: GigSort;
  take?: number;
}

export interface GigPackageInput {
  tier: "BASIC" | "STANDARD" | "PREMIUM";
  title: string;
  description?: string;
  priceUzs: number;
  deliveryDays: number;
  revisions: number;
}

export interface GigFaqItem {
  q: string;
  a: string;
}

export interface GigExtraInput {
  title: string;
  priceUzs: number;
  deliveryDays?: number;
}

export interface CreateGigInput {
  title: string;
  description: string;
  coverUrl?: string;
  coverFocal?: string;
  coverType?: string;
  coverPosterUrl?: string;
  coverW?: number;
  coverH?: number;
  galleryUrls?: string[];
  categoryId?: string;
  tags?: string[];
  locale?: string;
  faq?: GigFaqItem[];
  extras?: GigExtraInput[];
  requirementPrompts?: string[];
  draft?: boolean;
  packages: GigPackageInput[];
}

/** Sanitize + cap a gig's requirement question list. */
function cleanPrompts(prompts: string[] | undefined): string[] {
  return (prompts ?? [])
    .slice(0, 8)
    .map((p) => stripContactInfo(p).text.slice(0, 200).trim())
    .filter(Boolean);
}

/** Validate a cover focal point as a CSS object-position "x% y%" (0–100 each); else null. */
function normalizeFocal(focal?: string): string | null {
  const m = (focal ?? "").trim().match(/^(\d{1,3}(?:\.\d)?)%\s+(\d{1,3}(?:\.\d)?)%$/);
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  if (x < 0 || x > 100 || y < 0 || y > 100) return null;
  return `${x}% ${y}%`;
}

/** Cover pixel dimension: a sane positive integer, else null (unknown → fixed-frame fallback). */
function normalizeDim(n?: number): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const v = Math.round(n);
  return v > 0 && v <= 30000 ? v : null;
}

/** Cover banner kind — only "video" is special; everything else is an image. */
function normalizeCoverType(type?: string): "image" | "video" {
  return type === "video" ? "video" : "image";
}

/** Lowercase + de-dupe tags so they match the (lowercased) search/evidence term set. */
function normalizeTags(tags?: string[]): string[] {
  return [...new Set((tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}

/** Create a gig with its packages. New gigs are ACTIVE (moderation comes later). */
export async function createGig(sellerId: string, input: CreateGigInput, autoApprove = false) {
  // Strip off-platform contact info from public gig text (anti-escrow-bypass).
  const title = stripContactInfo(input.title).text;
  const description = stripContactInfo(input.description).text;
  // Sanitize FAQ text (anti-escrow-bypass); cap at 10 entries.
  const faq = (input.faq ?? [])
    .slice(0, 10)
    .map((f) => ({ q: stripContactInfo(f.q).text.slice(0, 200), a: stripContactInfo(f.a).text.slice(0, 1000) }))
    .filter((f) => f.q && f.a);
  const gig = await prisma.gig.create({
    data: {
      sellerId,
      title,
      slug: uniqueSlug(title),
      description,
      coverUrl: input.coverUrl || null,
      coverFocal: normalizeFocal(input.coverFocal),
      coverType: input.coverUrl ? normalizeCoverType(input.coverType) : "image",
      coverPosterUrl: input.coverUrl && input.coverType === "video" ? input.coverPosterUrl || null : null,
      coverW: input.coverUrl ? normalizeDim(input.coverW) : null,
      coverH: input.coverUrl ? normalizeDim(input.coverH) : null,
      galleryUrls: (input.galleryUrls ?? []).slice(0, 8),
      faq: faq.length ? faq : undefined,
      requirementPrompts: cleanPrompts(input.requirementPrompts),
      categoryId: input.categoryId || null,
      tags: normalizeTags(input.tags),
      locale: input.locale ?? "uz",
      // Drafts stay private; otherwise new gigs await moderation (admins publish immediately).
      status: input.draft ? "DRAFT" : autoApprove ? "ACTIVE" : "PENDING_REVIEW",
      extras: {
        create: (input.extras ?? [])
          .slice(0, 6)
          .filter((e) => e.title.trim() && e.priceUzs >= 1000)
          .map((e, i) => ({
            title: stripContactInfo(e.title).text.slice(0, 80),
            priceUzs: Math.round(e.priceUzs),
            deliveryDays: Math.max(0, Math.min(60, e.deliveryDays ?? 0)),
            position: i,
          })),
      },
      packages: {
        create: input.packages.map((p) => ({
          tier: p.tier,
          title: p.title,
          description: p.description,
          priceUzs: p.priceUzs,
          deliveryDays: p.deliveryDays,
          revisions: p.revisions,
        })),
      },
    },
    include: { packages: true },
  });
  await audit({ actorId: sellerId, action: "gig.create", entity: "Gig", entityId: gig.id });
  // Ping admins to moderate — one-tap approve/reject right in Telegram.
  if (gig.status === "PENDING_REVIEW") {
    await notifyAdmins("admin.gig_review", "🆕 Yangi gig tekshiruvda", {
      body: `"${gig.title}"`,
      buttons: adminGigReviewButtons(undefined, gig.id),
    });
  }
  return gig;
}

/**
 * Update an existing gig (owner or admin). Replaces packages + extras wholesale (no Order FK
 * references them — orders snapshot tier/title/extras), overwrites FAQ, and sanitizes text.
 * Status is left unchanged.
 */
export async function updateGig(gigId: string, user: GigActor, input: CreateGigInput) {
  const owned = await prisma.gig.findFirst({
    where: gigEditWhereForUser(gigId, user),
    select: { id: true },
  });
  if (!owned) throw Errors.notFound("Gig not found");

  const title = stripContactInfo(input.title).text;
  const description = stripContactInfo(input.description).text;
  const faq = (input.faq ?? [])
    .slice(0, 10)
    .map((f) => ({ q: stripContactInfo(f.q).text.slice(0, 200), a: stripContactInfo(f.a).text.slice(0, 1000) }))
    .filter((f) => f.q && f.a);

  await prisma.$transaction(async (tx) => {
    await tx.gigPackage.deleteMany({ where: { gigId } });
    await tx.gigExtra.deleteMany({ where: { gigId } });
    await tx.gig.update({
      where: { id: gigId },
      data: {
        title,
        description,
        coverUrl: input.coverUrl || null,
        coverFocal: normalizeFocal(input.coverFocal),
        coverType: input.coverUrl ? normalizeCoverType(input.coverType) : "image",
        coverPosterUrl: input.coverUrl && input.coverType === "video" ? input.coverPosterUrl || null : null,
        coverW: input.coverUrl ? normalizeDim(input.coverW) : null,
        coverH: input.coverUrl ? normalizeDim(input.coverH) : null,
        galleryUrls: (input.galleryUrls ?? []).slice(0, 8),
        categoryId: input.categoryId || null,
        tags: normalizeTags(input.tags),
        faq,
        requirementPrompts: cleanPrompts(input.requirementPrompts),
        packages: {
          create: input.packages.map((p) => ({
            tier: p.tier,
            title: p.title,
            description: p.description,
            priceUzs: p.priceUzs,
            deliveryDays: p.deliveryDays,
            revisions: p.revisions,
          })),
        },
        extras: {
          create: (input.extras ?? [])
            .slice(0, 6)
            .filter((e) => e.title.trim() && e.priceUzs >= 1000)
            .map((e, i) => ({
              title: stripContactInfo(e.title).text.slice(0, 80),
              priceUzs: Math.round(e.priceUzs),
              deliveryDays: Math.max(0, Math.min(60, e.deliveryDays ?? 0)),
              position: i,
            })),
        },
      },
    });
  });
  await audit({ actorId: user.id, action: "gig.update", entity: "Gig", entityId: gigId });
}

/** Fetch a gig for its owner to edit (includes packages + extras). */
export async function getGigForEdit(gigId: string, user: GigActor) {
  const gig = await prisma.gig.findFirst({
    where: gigEditWhereForUser(gigId, user),
    include: {
      packages: { orderBy: { tier: "asc" } },
      extras: { orderBy: { position: "asc" } },
    },
  });
  if (!gig) throw Errors.notFound("Gig not found");
  return gig;
}

export function listSellerGigs(sellerId: string) {
  return prisma.gig.findMany({
    where: { sellerId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      packages: { orderBy: { priceUzs: "asc" }, take: 1 },
      category: true,
      _count: { select: { orders: true } },
    },
  });
}

type GigActor = Pick<User, "id" | "role">;

/** Pause / resume / soft-delete a gig — owner (or admin) only, scoped via gigEditWhereForUser. */
async function updateOwnedGig(gigId: string, user: GigActor, data: Prisma.GigUpdateManyMutationInput, action: string) {
  const res = await prisma.gig.updateMany({
    where: { ...gigEditWhereForUser(gigId, user), deletedAt: null },
    data,
  });
  if (res.count === 0) throw Errors.notFound("Gig not found");
  await audit({ actorId: user.id, action, entity: "Gig", entityId: gigId });
}

export const pauseGig = (gigId: string, user: GigActor) =>
  updateOwnedGig(gigId, user, { status: "PAUSED" }, "gig.pause");
export const resumeGig = (gigId: string, user: GigActor) =>
  updateOwnedGig(gigId, user, { status: "ACTIVE" }, "gig.resume");
export const softDeleteGig = (gigId: string, user: GigActor) =>
  updateOwnedGig(gigId, user, { deletedAt: new Date(), status: "PAUSED" }, "gig.softDelete");

/** Gigs awaiting moderation — admin queue. */
export function listPendingGigs() {
  return prisma.gig.findMany({
    where: { status: "PENDING_REVIEW", deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      packages: { orderBy: { priceUzs: "asc" }, take: 1 },
      seller: { select: { firstName: true, name: true, username: true } },
    },
  });
}

async function moderateGig(gigId: string, admin: GigActor, status: "ACTIVE" | "REJECTED", action: string) {
  if (admin.role !== "ADMIN") throw Errors.forbidden("Admins only");
  const res = await prisma.gig.updateMany({ where: { id: gigId, deletedAt: null }, data: { status } });
  if (res.count === 0) throw Errors.notFound("Gig not found");
  await audit({ actorId: admin.id, action, entity: "Gig", entityId: gigId });
  const gig = await prisma.gig.findUnique({
    where: { id: gigId },
    select: { sellerId: true, title: true, slug: true },
  });
  if (!gig) return;
  // Tell the seller the moderation outcome (both approve + reject).
  if (status === "ACTIVE") {
    await notifyAndPush(gig.sellerId, "gig.approved", "Xizmatingiz tasdiqlandi", {
      body: `"${gig.title}" endi omma uchun koʻrinadi.`,
      link: `/gigs/${gig.slug}`,
    });
    // A newly-approved gig is now public — let the seller's followers know (best-effort).
    await notifyFollowersOfNewGig(gig.sellerId, gig.title, gig.slug).catch(() => {});
  } else {
    await notifyAndPush(gig.sellerId, "gig.rejected", "Xizmat tasdiqlanmadi", {
      body: `"${gig.title}" moderatsiyadan oʻtmadi. Iltimos, qoidalarni tekshirib qayta yuboring.`,
      link: `/dashboard/seller`,
    });
  }
}

export const approveGig = (gigId: string, admin: GigActor) =>
  moderateGig(gigId, admin, "ACTIVE", "gig.approve");
export const rejectGig = (gigId: string, admin: GigActor) =>
  moderateGig(gigId, admin, "REJECTED", "gig.reject");

/** Anyone can report a live gig — logged for admin review (non-hiding to prevent griefing). */
export async function reportGig(gigId: string, reporter: GigActor) {
  await audit({ actorId: reporter.id, action: "gig.report", entity: "Gig", entityId: gigId });
}

/** Duplicate an owned gig into a new DRAFT (title + " (copy)"). */
export async function duplicateGig(gigId: string, user: GigActor) {
  const src = await prisma.gig.findFirst({
    where: { ...gigEditWhereForUser(gigId, user), deletedAt: null },
    include: { packages: true, extras: true },
  });
  if (!src) throw Errors.notFound("Gig not found");
  const input: CreateGigInput = {
    title: `${src.title} (copy)`.slice(0, 80),
    description: src.description,
    coverUrl: src.coverUrl ?? undefined,
    galleryUrls: src.galleryUrls,
    categoryId: src.categoryId ?? undefined,
    tags: src.tags,
    faq: Array.isArray(src.faq) ? (src.faq as unknown as GigFaqItem[]) : undefined,
    requirementPrompts: Array.isArray(src.requirementPrompts)
      ? (src.requirementPrompts as unknown as string[])
      : undefined,
    extras: src.extras.map((e) => ({ title: e.title, priceUzs: e.priceUzs, deliveryDays: e.deliveryDays })),
    draft: true,
    packages: src.packages.map((p) => ({
      tier: p.tier,
      title: p.title,
      description: p.description ?? undefined,
      priceUzs: p.priceUzs,
      deliveryDays: p.deliveryDays,
      revisions: p.revisions,
    })),
  };
  return createGig(user.id, input);
}

/** Publish a DRAFT gig — owner → PENDING_REVIEW, admin → ACTIVE. */
export async function publishGig(gigId: string, user: GigActor) {
  const status = user.role === "ADMIN" ? "ACTIVE" : "PENDING_REVIEW";
  const res = await prisma.gig.updateMany({
    where: { ...gigEditWhereForUser(gigId, user), status: "DRAFT", deletedAt: null },
    data: { status },
  });
  if (res.count === 0) throw Errors.notFound("Draft gig not found");
  await audit({ actorId: user.id, action: "gig.publish", entity: "Gig", entityId: gigId });
  if (status === "PENDING_REVIEW") {
    const g = await prisma.gig.findUnique({ where: { id: gigId }, select: { title: true } });
    await notifyAdmins("admin.gig_review", "🆕 Yangi gig tekshiruvda", {
      body: g ? `"${g.title}"` : undefined,
      buttons: adminGigReviewButtons(undefined, gigId),
    });
  }
}

/** Admin-only: feature/unfeature a gig (boosts it in listings for `days`). */
export async function setGigFeatured(gigId: string, admin: GigActor, featured: boolean, days = 30) {
  if (admin.role !== "ADMIN") throw Errors.forbidden("Admins only");
  const featuredUntil = featured ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
  const res = await prisma.gig.updateMany({ where: { id: gigId, deletedAt: null }, data: { featured, featuredUntil } });
  if (res.count === 0) throw Errors.notFound("Gig not found");
  await audit({ actorId: admin.id, action: featured ? "gig.feature" : "gig.unfeature", entity: "Gig", entityId: gigId });
}

/** Other active gigs in the same category (excluding this one) — for the "similar gigs" row. */
export function listRelatedGigs(gigId: string, categoryId: string | null, take = 6) {
  return prisma.gig.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      ...PUBLIC_GIG_SELLER,
      id: { not: gigId },
      ...(categoryId ? { categoryId } : {}),
    },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take,
    include: { packages: { orderBy: { priceUzs: "asc" }, take: 1 } },
  });
}

/** Featured, non-expired active gigs for the home row. */
function listFeaturedGigsUncached(take = 8) {
  return prisma.gig.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      ...PUBLIC_GIG_SELLER,
      featured: true,
      OR: [{ featuredUntil: null }, { featuredUntil: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      packages: { orderBy: { priceUzs: "asc" }, take: 1 },
      seller: {
        select: {
          firstName: true,
          username: true,
          name: true,
          image: true,
          photoUrl: true,
          sellerProfile: { select: { ratingAvg: true, ratingCount: true } },
        },
      },
      category: { select: { slug: true } },
    },
  });
}

/** Fuzzy (typo-tolerant) text match via pg_trgm; falls back to ILIKE if trigram is unavailable. */
async function fuzzyTextWhere(q: string): Promise<Prisma.GigWhereInput> {
  const ilike: Prisma.GigWhereInput = {
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { tags: { has: q.toLowerCase() } },
    ],
  };
  try {
    const like = `%${q}%`;
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT g.id FROM "Gig" g
      JOIN "User" u ON u.id = g."sellerId" AND u."isSeller" = true AND u.status = 'ACTIVE'
      JOIN "SellerProfile" sp ON sp."userId" = g."sellerId" AND sp."approvalStatus" = 'APPROVED'
      WHERE g.status = 'ACTIVE' AND g."deletedAt" IS NULL
        AND (word_similarity(${q}, g.title) >= 0.3 OR word_similarity(${q}, g.description) >= 0.3
             OR g.title ILIKE ${like} OR g.description ILIKE ${like}
             OR ${q.toLowerCase()} = ANY(g.tags))
      ORDER BY GREATEST(word_similarity(${q}, g.title), word_similarity(${q}, g.description)) DESC
      LIMIT 200`;
    return { id: { in: rows.map((r) => r.id) } };
  } catch {
    return ilike;
  }
}

async function listPublicGigsUncached(opts: GigFilters = {}) {
  const q = opts.q?.trim();
  const textWhere = q ? await fuzzyTextWhere(q) : {};
  const where: Prisma.GigWhereInput = {
    status: "ACTIVE",
    deletedAt: null,
    ...PUBLIC_GIG_SELLER,
    ...(opts.categorySlug ? { category: { slug: opts.categorySlug } } : {}),
    ...textWhere,
    ...(opts.minUzs != null || opts.maxUzs != null
      ? {
          packages: {
            some: {
              priceUzs: {
                ...(opts.minUzs != null ? { gte: opts.minUzs } : {}),
                ...(opts.maxUzs != null ? { lte: opts.maxUzs } : {}),
              },
            },
          },
        }
      : {}),
  };

  const orderBy: Prisma.GigOrderByWithRelationInput[] =
    opts.sort === "popular"
      ? [{ featured: "desc" }, { orders: { _count: "desc" } }, { createdAt: "desc" }]
      : [{ featured: "desc" }, { createdAt: "desc" }, { id: "desc" }];

  const gigs = await prisma.gig.findMany({
    where,
    orderBy,
    take: opts.take ?? 48,
    include: {
      packages: { orderBy: { priceUzs: "asc" }, take: 1 },
      seller: {
        select: {
          firstName: true,
          username: true,
          name: true,
          photoUrl: true,
          image: true,
          sellerProfile: { select: { ratingAvg: true, ratingCount: true, level: true } },
        },
      },
      _count: { select: { orders: true } },
    },
  });

  // Price sort uses the lowest package; done in-app (Prisma can't orderBy a relation min here).
  if (opts.sort === "price_asc" || opts.sort === "price_desc") {
    gigs.sort((a, b) => {
      const pa = a.packages[0]?.priceUzs ?? 0;
      const pb = b.packages[0]?.priceUzs ?? 0;
      return opts.sort === "price_asc" ? pa - pb : pb - pa;
    });
  }
  return gigs;
}

// Public catalog reads are cached 60s per argument-combination (unstable_cache keys
// include args). Cuts DB load ~10x on the hot anonymous pages (home, marketplace,
// categories); worst case a new/edited gig appears with ≤60s delay. NOTE: cached
// results are serialized, so Date fields come back as strings — public pages must
// not call Date methods on them directly (they don't today).
const listPublicGigsCached = unstable_cache(listPublicGigsUncached, ["public-gigs"], {
  revalidate: 60,
});

/**
 * Cache only the bounded hot paths (filterless / category / price / sort). Free-text `q`
 * has unbounded key cardinality — every distinct query (crawlers included) writes a new
 * data-cache entry that never evicts, with a near-zero hit rate — so run those uncached.
 */
export function listPublicGigs(opts: GigFilters = {}) {
  if (opts.q?.trim()) return listPublicGigsUncached(opts);
  return listPublicGigsCached(opts);
}
export const listFeaturedGigs = unstable_cache(listFeaturedGigsUncached, ["featured-gigs"], {
  revalidate: 60,
});

export function getGigBySlug(slug: string) {
  return prisma.gig.findFirst({
    where: { slug, status: "ACTIVE", deletedAt: null, ...PUBLIC_GIG_SELLER },
    include: {
      packages: { orderBy: { priceUzs: "asc" } },
      extras: { orderBy: { position: "asc" } },
      category: true,
      seller: {
        select: {
          firstName: true,
          username: true,
          name: true,
          image: true,
          kycStatus: true,
          sellerProfile: {
            select: { headline: true, bio: true, ratingAvg: true, ratingCount: true, level: true, responseMins: true },
          },
        },
      },
    },
  });
}

/** Bump a gig's view counter; best-effort (never blocks or throws on the page). */
export async function incrementGigViews(gigId: string) {
  await prisma.gig.update({ where: { id: gigId }, data: { views: { increment: 1 } } }).catch(() => {});
}

/** Active gigs by id, preserving the given id order — for the "recently viewed" row. */
export async function getGigsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const gigs = await prisma.gig.findMany({
    where: { id: { in: ids.slice(0, 12) }, status: "ACTIVE", deletedAt: null, ...PUBLIC_GIG_SELLER },
    include: {
      packages: { orderBy: { priceUzs: "asc" }, take: 1 },
      seller: { select: { firstName: true, username: true, name: true } },
    },
  });
  const order = new Map(ids.map((id, i) => [id, i]));
  return gigs.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
}
