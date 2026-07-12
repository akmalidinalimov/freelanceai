import "server-only";
import { prisma } from "@/lib/prisma";

/** Toggle a gig in the user's saved list; returns the new saved state. */
export async function toggleSaved(userId: string, gigId: string): Promise<boolean> {
  const key = { userId_gigId: { userId, gigId } };
  const existing = await prisma.savedGig.findUnique({ where: key });
  if (existing) {
    await prisma.savedGig.delete({ where: key });
    return false;
  }
  await prisma.savedGig.create({ data: { userId, gigId } });
  return true;
}

/** Set of gig ids the user has saved — for marking cards in a list. */
export async function listSavedGigIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.savedGig.findMany({ where: { userId }, select: { gigId: true } });
  return new Set(rows.map((r) => r.gigId));
}

export async function isGigSaved(userId: string, gigId: string): Promise<boolean> {
  const e = await prisma.savedGig.findUnique({ where: { userId_gigId: { userId, gigId } } });
  return Boolean(e);
}

/** Active saved gigs for a user (newest first). */
export async function listSavedGigs(userId: string) {
  const rows = await prisma.savedGig.findMany({
    where: { userId, gig: { status: "ACTIVE", deletedAt: null } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { gig: { include: { packages: { orderBy: { priceUzs: "asc" }, take: 1 } } } },
  });
  return rows.map((r) => r.gig);
}
