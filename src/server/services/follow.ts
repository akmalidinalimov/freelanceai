import "server-only";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/api";
import { notify } from "@/server/services/notification";

/** Toggle following a seller. Returns the new state. */
export async function toggleFollow(followerId: string, sellerId: string): Promise<{ following: boolean }> {
  if (followerId === sellerId) throw Errors.validation({ sellerId: "You cannot follow yourself" });
  const seller = await prisma.user.findFirst({ where: { id: sellerId, isSeller: true } });
  if (!seller) throw Errors.notFound("Creator not found");

  const existing = await prisma.follow.findUnique({
    where: { followerId_sellerId: { followerId, sellerId } },
  });
  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    return { following: false };
  }
  await prisma.follow.create({ data: { followerId, sellerId } });
  return { following: true };
}

export async function isFollowing(followerId: string, sellerId: string): Promise<boolean> {
  const f = await prisma.follow.findUnique({
    where: { followerId_sellerId: { followerId, sellerId } },
  });
  return Boolean(f);
}

export function countFollowers(sellerId: string): Promise<number> {
  return prisma.follow.count({ where: { sellerId } });
}

/** Notify a seller's followers that they published a new gig. Best-effort. */
export async function notifyFollowersOfNewGig(sellerId: string, gigTitle: string, gigSlug: string): Promise<void> {
  const followers = await prisma.follow.findMany({ where: { sellerId }, select: { followerId: true } });
  await Promise.all(
    followers.map((f) =>
      notify(f.followerId, "gig.new", "Kuzatuvchingizdan yangi xizmat", {
        body: gigTitle,
        link: `/gigs/${gigSlug}`,
      })
    )
  );
}
