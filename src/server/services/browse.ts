import "server-only";
import { prisma } from "@/lib/prisma";

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

/** Active sellers who declared a given specialization key, best first. */
export async function listCreatorsBySpecialization(key: string): Promise<BrowseCreator[]> {
  const profs = await prisma.sellerProfile.findMany({
    where: {
      specializations: { has: key },
      user: { isSeller: true, status: "ACTIVE" },
    },
    select: {
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
    },
    orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
    take: 48,
  });
  return profs.map((p) => ({
    username: p.user.username,
    name: p.user.firstName ?? p.user.name ?? p.user.username ?? "",
    avatar: p.user.image ?? p.user.photoUrl ?? null,
    verified: p.user.kycStatus === "VERIFIED",
    level: p.level,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    headline: p.headline,
    specializations: p.specializations,
  }));
}
