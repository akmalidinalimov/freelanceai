import "server-only";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";
import { recomputeSellerStats } from "@/server/services/profile";
import { stripContactInfo } from "@/lib/sanitize";
import { notify } from "@/server/services/notification";

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

  // Recompute the seller's rating aggregate + level.
  await recomputeSellerStats(order.sellerId);

  await audit({ actorId: authorId, action: "review.create", entity: "Review", entityId: review.id });
  await notify(order.sellerId, "review.new", "Yangi sharh", {
    body: `Buyurtmangizga ${rating}★ sharh qoldirildi.`,
    link: `/orders/${orderId}`,
  });
  return review;
}

export function getOrderReview(orderId: string) {
  return prisma.review.findUnique({ where: { orderId } });
}

/** Reviews for a gig + average/count + star distribution, for the public gig page. */
export async function getGigReviews(gigId: string) {
  const [reviews, agg, grouped] = await Promise.all([
    prisma.review.findMany({
      where: { gigId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { author: { select: { firstName: true, name: true, username: true } } },
    }),
    prisma.review.aggregate({ where: { gigId }, _avg: { rating: true }, _count: true }),
    prisma.review.groupBy({ by: ["rating"], where: { gigId }, _count: true }),
  ]);
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: grouped.find((g) => g.rating === star)?._count ?? 0,
  }));
  return { reviews, avg: agg._avg.rating ?? 0, count: agg._count, distribution };
}

/** Seller replies to a review on their gig (sanitized; one response). */
export async function addSellerReply(reviewId: string, seller: User, response: string) {
  const text = stripContactInfo(response.trim()).text;
  if (!text) throw Errors.validation({ response: "Reply is empty" });
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { gig: { select: { sellerId: true } } },
  });
  if (!review) throw Errors.notFound("Review not found");
  if (review.gig.sellerId !== seller.id && seller.role !== "ADMIN") throw Errors.forbidden();
  await prisma.review.update({ where: { id: reviewId }, data: { sellerResponse: text } });
  await audit({ actorId: seller.id, action: "review.reply", entity: "Review", entityId: reviewId });
}
