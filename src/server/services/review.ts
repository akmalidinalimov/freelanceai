import "server-only";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";

/** A buyer reviews a COMPLETED order once; recomputes the seller's rating aggregate. */
export async function createReview(
  authorId: string,
  orderId: string,
  rating: number,
  comment?: string
) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw Errors.validation({ rating: "Rating must be 1–5" });
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Errors.notFound("Order not found");
  if (order.buyerId !== authorId) throw Errors.forbidden();
  if (order.status !== "COMPLETED") throw Errors.conflict("Only completed orders can be reviewed");

  const existing = await prisma.review.findUnique({ where: { orderId } });
  if (existing) throw Errors.conflict("This order is already reviewed");

  const review = await prisma.review.create({
    data: { orderId, gigId: order.gigId, authorId, rating, comment: comment?.trim() || null },
  });

  // Recompute the seller's overall rating across all their gigs.
  const agg = await prisma.review.aggregate({
    where: { gig: { sellerId: order.sellerId } },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.sellerProfile.upsert({
    where: { userId: order.sellerId },
    create: { userId: order.sellerId, ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
    update: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
  });

  await audit({ actorId: authorId, action: "review.create", entity: "Review", entityId: review.id });
  return review;
}

export function getOrderReview(orderId: string) {
  return prisma.review.findUnique({ where: { orderId } });
}

/** Reviews for a gig + its average/count, for the public gig page. */
export async function getGigReviews(gigId: string) {
  const [reviews, agg] = await Promise.all([
    prisma.review.findMany({
      where: { gigId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { author: { select: { firstName: true, name: true, username: true } } },
    }),
    prisma.review.aggregate({ where: { gigId }, _avg: { rating: true }, _count: true }),
  ]);
  return { reviews, avg: agg._avg.rating ?? 0, count: agg._count };
}
