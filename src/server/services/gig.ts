import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, User } from "@prisma/client";
import { uniqueSlug } from "@/lib/slug";
import { audit } from "@/lib/audit";
import { stripContactInfo } from "@/lib/sanitize";
import { Errors } from "@/lib/api";
import { gigEditWhereForUser } from "@/lib/authz";

export type GigSort = "newest" | "price_asc" | "price_desc";
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

export interface CreateGigInput {
  title: string;
  description: string;
  coverUrl?: string;
  galleryUrls?: string[];
  categoryId?: string;
  tags?: string[];
  locale?: string;
  packages: GigPackageInput[];
}

/** Create a gig with its packages. New gigs are ACTIVE (moderation comes later). */
export async function createGig(sellerId: string, input: CreateGigInput) {
  // Strip off-platform contact info from public gig text (anti-escrow-bypass).
  const title = stripContactInfo(input.title).text;
  const description = stripContactInfo(input.description).text;
  const gig = await prisma.gig.create({
    data: {
      sellerId,
      title,
      slug: uniqueSlug(title),
      description,
      coverUrl: input.coverUrl || null,
      galleryUrls: (input.galleryUrls ?? []).slice(0, 8),
      categoryId: input.categoryId || null,
      tags: input.tags ?? [],
      locale: input.locale ?? "uz",
      status: "ACTIVE",
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
  return gig;
}

export function listSellerGigs(sellerId: string) {
  return prisma.gig.findMany({
    where: { sellerId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { packages: { orderBy: { priceUzs: "asc" }, take: 1 }, category: true },
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

export async function listPublicGigs(opts: GigFilters = {}) {
  const q = opts.q?.trim();
  const where: Prisma.GigWhereInput = {
    status: "ACTIVE",
    deletedAt: null,
    ...(opts.categorySlug ? { category: { slug: opts.categorySlug } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { tags: { has: q.toLowerCase() } },
          ],
        }
      : {}),
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

  const gigs = await prisma.gig.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: opts.take ?? 48,
    include: {
      packages: { orderBy: { priceUzs: "asc" }, take: 1 },
      seller: { select: { firstName: true, username: true, name: true } },
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

export function getGigBySlug(slug: string) {
  return prisma.gig.findFirst({
    where: { slug, status: "ACTIVE", deletedAt: null },
    include: {
      packages: { orderBy: { priceUzs: "asc" } },
      category: true,
      seller: {
        select: {
          firstName: true,
          username: true,
          name: true,
          sellerProfile: { select: { headline: true, bio: true, ratingAvg: true, ratingCount: true } },
        },
      },
    },
  });
}
