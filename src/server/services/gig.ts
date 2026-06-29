import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { uniqueSlug } from "@/lib/slug";
import { audit } from "@/lib/audit";
import { stripContactInfo } from "@/lib/sanitize";

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
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    include: { packages: { orderBy: { priceUzs: "asc" }, take: 1 }, category: true },
  });
}

export async function listPublicGigs(opts: GigFilters = {}) {
  const q = opts.q?.trim();
  const where: Prisma.GigWhereInput = {
    status: "ACTIVE",
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
    where: { slug, status: "ACTIVE" },
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
