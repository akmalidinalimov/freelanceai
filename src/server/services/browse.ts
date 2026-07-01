import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export interface BrowseCreator {
  username: string | null;
  name: string;
  avatar: string | null;
  verified: boolean;
  level: string;
  ratingAvg: number;
  ratingCount: number;
  headline: string | null;
  specializations: string[];
}

const sellerSelect = {
  ratingAvg: true,
  ratingCount: true,
  level: true,
  specializations: true,
  headline: true,
  user: {
    select: {
      username: true,
      firstName: true,
      name: true,
      image: true,
      photoUrl: true,
      kycStatus: true,
    },
  },
} satisfies Prisma.SellerProfileSelect;

type SellerRow = Prisma.SellerProfileGetPayload<{ select: typeof sellerSelect }>;

function toCreator(p: SellerRow): BrowseCreator {
  return {
    username: p.user.username,
    name: p.user.firstName ?? p.user.name ?? p.user.username ?? "",
    avatar: p.user.image ?? p.user.photoUrl ?? null,
    verified: p.user.kycStatus === "VERIFIED",
    level: p.level,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    headline: p.headline,
    specializations: p.specializations,
  };
}

/** Active sellers who declared a given specialization key, best first. */
export async function listCreatorsBySpecialization(key: string): Promise<BrowseCreator[]> {
  const rows = await prisma.sellerProfile.findMany({
    where: { specializations: { has: key }, user: { isSeller: true, status: "ACTIVE" } },
    select: sellerSelect,
    orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
    take: 48,
  });
  return rows.map(toCreator);
}

/** Featured creators for the homepage rail: active sellers with at least one live gig. */
export async function listFeaturedCreators(limit = 8): Promise<BrowseCreator[]> {
  const rows = await prisma.sellerProfile.findMany({
    where: {
      user: {
        isSeller: true,
        status: "ACTIVE",
        gigs: { some: { status: "ACTIVE", deletedAt: null } },
      },
    },
    select: sellerSelect,
    orderBy: [{ ratingCount: "desc" }, { ratingAvg: "desc" }],
    take: limit,
  });
  return rows.map(toCreator);
}

/** All active sellers for the /creators index, best-rated first. */
export async function listAllCreators(take = 60): Promise<BrowseCreator[]> {
  const rows = await prisma.sellerProfile.findMany({
    where: { user: { isSeller: true, status: "ACTIVE" } },
    select: sellerSelect,
    orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
    take,
  });
  return rows.map(toCreator);
}
