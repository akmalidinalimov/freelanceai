import "server-only";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/slug";
import { audit } from "@/lib/audit";

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
  categoryId?: string;
  tags?: string[];
  locale?: string;
  packages: GigPackageInput[];
}

/** Create a gig with its packages. New gigs are ACTIVE (moderation comes later). */
export async function createGig(sellerId: string, input: CreateGigInput) {
  const gig = await prisma.gig.create({
    data: {
      sellerId,
      title: input.title,
      slug: uniqueSlug(input.title),
      description: input.description,
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

export function listPublicGigs(opts?: { categorySlug?: string; take?: number }) {
  return prisma.gig.findMany({
    where: {
      status: "ACTIVE",
      ...(opts?.categorySlug ? { category: { slug: opts.categorySlug } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: opts?.take ?? 24,
    include: {
      packages: { orderBy: { priceUzs: "asc" }, take: 1 },
      seller: { select: { firstName: true, username: true, name: true } },
    },
  });
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
