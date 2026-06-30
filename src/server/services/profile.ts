import "server-only";
import { prisma } from "@/lib/prisma";
import { stripContactInfo } from "@/lib/sanitize";
import { computeSellerLevel } from "@/lib/seller-level";

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
export async function getPublicProfile(username: string) {
  const user = await prisma.user.findFirst({
    where: { username, isSeller: true, status: "ACTIVE" },
    select: {
      id: true,
      firstName: true,
      name: true,
      username: true,
      image: true,
      photoUrl: true,
      createdAt: true,
    },
  });
  if (!user) return null;

  const [profile, gigs] = await Promise.all([
    prisma.sellerProfile.findUnique({ where: { userId: user.id } }),
    prisma.gig.findMany({
      where: { sellerId: user.id, status: "ACTIVE", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 24,
      include: { packages: { orderBy: { priceUzs: "asc" }, take: 1 } },
    }),
  ]);

  return { user, profile, gigs };
}

export function getOwnProfile(userId: string) {
  return prisma.sellerProfile.findUnique({ where: { userId } });
}

export interface ProfileInput {
  headline?: string;
  bio?: string;
  skills?: string[];
  aiTools?: string[];
}

/** Update the caller's own seller profile (level/rating excluded — job-set only). Bio/headline sanitized. */
export async function updateOwnProfile(userId: string, input: ProfileInput) {
  const data = {
    ...(input.headline !== undefined ? { headline: stripContactInfo(input.headline).text.trim() || null } : {}),
    ...(input.bio !== undefined ? { bio: stripContactInfo(input.bio).text.trim() || null } : {}),
    ...(input.skills !== undefined ? { skills: input.skills } : {}),
    ...(input.aiTools !== undefined ? { aiTools: input.aiTools } : {}),
  };
  return prisma.sellerProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}
