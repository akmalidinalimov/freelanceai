import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/api";
import { stripContactInfo } from "@/lib/sanitize";
import { computeSellerLevel } from "@/lib/seller-level";
import { sanitizeSpecKeys } from "@/lib/specializations";
import { provenSpecKeys } from "@/lib/niche-evidence";

const PORTFOLIO_MAX = 12;

/** Recompute a seller's rating aggregate + level from completed orders and reviews. */
export async function recomputeSellerStats(sellerId: string) {
  const [completed, agg] = await Promise.all([
    prisma.order.count({ where: { sellerId, status: "COMPLETED" } }),
    prisma.review.aggregate({ where: { gig: { sellerId } }, _avg: { rating: true }, _count: true }),
  ]);
  const ratingAvg = agg._avg.rating ?? 0;
  const ratingCount = agg._count;
  const level = computeSellerLevel(completed, ratingAvg, ratingCount);
  await prisma.sellerProfile.upsert({
    where: { userId: sellerId },
    create: { userId: sellerId, ratingAvg, ratingCount, level },
    update: { ratingAvg, ratingCount, level },
  });
}

/**
 * Public seller storefront by username. 404s (returns null) for non-sellers,
 * suspended/deleted accounts — existence is never revealed (DATA-PROTECTION).
 */
async function getPublicProfileUncached(username: string) {
  const user = await prisma.user.findFirst({
    where: { username, isSeller: true, status: "ACTIVE" },
    select: {
      id: true,
      firstName: true,
      name: true,
      username: true,
      image: true,
      photoUrl: true,
      kycStatus: true,
      createdAt: true,
    },
  });
  if (!user) return null;

  const [profile, gigs] = await Promise.all([
    prisma.sellerProfile.findUnique({
      where: { userId: user.id },
      include: { portfolio: { orderBy: { position: "asc" } } },
    }),
    prisma.gig.findMany({
      where: { sellerId: user.id, status: "ACTIVE", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 24,
      include: { packages: { orderBy: { priceUzs: "asc" }, take: 1 } },
    }),
  ]);

  return { user, profile, gigs };
}

// Public storefront cached 60s per username (page still renders per-request for the
// viewer-specific bits — follow state etc. — those are separate uncached calls).
// Date fields deserialize as strings; the page already wraps createdAt in new Date().
export const getPublicProfile = unstable_cache(getPublicProfileUncached, ["public-profile"], {
  revalidate: 60,
});

/**
 * Spec keys a seller has *proven* (evidence beyond declaration: active gig tags/category
 * or completed-order categories). Drives the ✓ "verified specialization" marker.
 */
export async function getProvenSpecKeys(sellerId: string): Promise<Set<string>> {
  const [gigs, orders] = await Promise.all([
    prisma.gig.findMany({
      where: { sellerId, status: "ACTIVE", deletedAt: null },
      select: { tags: true, category: { select: { slug: true } } },
      take: 100,
    }),
    prisma.order.findMany({
      where: { sellerId, status: "COMPLETED" },
      select: { gig: { select: { category: { select: { slug: true } } } } },
      take: 200,
    }),
  ]);
  return provenSpecKeys({
    declared: [],
    gigTags: gigs.flatMap((g) => g.tags),
    gigCategorySlugs: gigs.map((g) => g.category?.slug).filter((s): s is string => !!s),
    orderCategorySlugs: orders.map((o) => o.gig.category?.slug).filter((s): s is string => !!s),
  });
}

export function getOwnProfile(userId: string) {
  return prisma.sellerProfile.findUnique({
    where: { userId },
    include: { portfolio: { orderBy: { position: "asc" } } },
  });
}

/** Add a portfolio item to the caller's seller profile (creating the profile if needed). */
export async function addPortfolioItem(
  userId: string,
  mediaUrl: string,
  mediaType?: string,
  caption?: string
) {
  const profile = await prisma.sellerProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  const count = await prisma.portfolioItem.count({ where: { profileId: profile.id } });
  if (count >= PORTFOLIO_MAX) throw Errors.validation({ portfolio: "Portfolio is full" });
  return prisma.portfolioItem.create({
    data: {
      profileId: profile.id,
      mediaUrl,
      mediaType: mediaType === "video" ? "video" : "image",
      caption: caption?.trim() || null,
      position: count,
    },
  });
}

/** Remove a portfolio item the caller owns. */
export async function removePortfolioItem(userId: string, itemId: string) {
  const item = await prisma.portfolioItem.findUnique({
    where: { id: itemId },
    include: { profile: { select: { userId: true } } },
  });
  if (!item || item.profile.userId !== userId) throw Errors.notFound("Item not found");
  await prisma.portfolioItem.delete({ where: { id: itemId } });
}

export interface ProfileInput {
  headline?: string;
  bio?: string;
  skills?: string[];
  aiTools?: string[];
  specializations?: string[];
  instagramUsername?: string;
}

/** Update the caller's own seller profile (level/rating excluded — job-set only). Bio/headline sanitized. */
export async function updateOwnProfile(userId: string, input: ProfileInput) {
  const data = {
    ...(input.headline !== undefined ? { headline: stripContactInfo(input.headline).text.trim() || null } : {}),
    ...(input.bio !== undefined ? { bio: stripContactInfo(input.bio).text.trim() || null } : {}),
    ...(input.skills !== undefined ? { skills: input.skills } : {}),
    ...(input.aiTools !== undefined ? { aiTools: input.aiTools } : {}),
    ...(input.specializations !== undefined
      ? { specializations: sanitizeSpecKeys(input.specializations) }
      : {}),
    ...(input.instagramUsername !== undefined
      ? {
          instagramUsername:
            input.instagramUsername.replace(/[^A-Za-z0-9._]/g, "").slice(0, 30) || null,
        }
      : {}),
  };
  return prisma.sellerProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}
