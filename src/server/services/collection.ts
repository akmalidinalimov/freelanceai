import "server-only";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/api";

export async function createCollection(userId: string, name: string) {
  const n = name.trim().slice(0, 60);
  if (!n) throw Errors.validation({ name: "Name is required" });
  const count = await prisma.collection.count({ where: { userId } });
  if (count >= 30) throw Errors.validation({ name: "Collection limit reached" });
  return prisma.collection.create({ data: { userId, name: n } });
}

export async function deleteCollection(userId: string, id: string) {
  const res = await prisma.collection.deleteMany({ where: { id, userId } });
  if (res.count === 0) throw Errors.notFound("Collection not found");
}

export function listCollections(userId: string) {
  return prisma.collection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { savedGigs: true } } },
  });
}

/** Assign (or clear, with null) a saved gig's collection — both must belong to the user. */
export async function assignSavedToCollection(userId: string, gigId: string, collectionId: string | null) {
  const saved = await prisma.savedGig.findUnique({ where: { userId_gigId: { userId, gigId } } });
  if (!saved) throw Errors.notFound("Saved gig not found");
  if (collectionId) {
    const col = await prisma.collection.findFirst({ where: { id: collectionId, userId } });
    if (!col) throw Errors.notFound("Collection not found");
  }
  await prisma.savedGig.update({
    where: { userId_gigId: { userId, gigId } },
    data: { collectionId },
  });
}

/** Saved gigs (optionally within one collection), with each gig's current collection id. */
export async function listSavedWithCollection(userId: string, collectionId?: string) {
  const rows = await prisma.savedGig.findMany({
    where: {
      userId,
      gig: { status: "ACTIVE", deletedAt: null },
      ...(collectionId ? { collectionId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { gig: { include: { packages: { orderBy: { priceUzs: "asc" }, take: 1 } } } },
  });
  return rows.map((r) => ({ gig: r.gig, collectionId: r.collectionId }));
}
