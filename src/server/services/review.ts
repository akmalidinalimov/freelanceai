import "server-only";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";
import { onReviewCreated } from "@/server/services/gamification";
import { recomputeSellerStats } from "@/server/services/profile";
import { stripContactInfo } from "@/lib/sanitize";
import { notifyAndPush } from "@/server/services/notification";

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
  // A COMPLETED order is not necessarily a REAL one. Under FREE_ORDERS every order is isTest and
  // auto-settles for 0 UZS, so create -> deliver -> accept -> review was four free calls that
  // minted public reputation at zero cost (audit 2026-08-10, S3).
  if (order.isTest) throw Errors.conflict("Test orders cannot be reviewed");

  const existing = await prisma.review.findUnique({ where: { orderId } });
  if (existing) throw Errors.conflict("This order is already reviewed");

  const review = await prisma.review.create({
    data: { orderId, gigId: order.gigId, authorId, rating, comment: comment?.trim() || null },
  });

  // Recompute the seller's rating aggregate + level.
  await recomputeSellerStats(order.sellerId);

  onReviewCreated(authorId);
  await audit({ actorId: authorId, action: "review.create", entity: "Review", entityId: review.id });
  await notifyAndPush(order.sellerId, "review.new", "Yangi sharh", {
    body: `Buyurtmangizga ${rating}★ sharh qoldirildi.`,
    link: `/orders/${orderId}`,
  });
  return review;
}

export function getOrderReview(orderId: string) {
  return prisma.review.findUnique({ where: { orderId } });
}

/** Seller reviews the buyer on a COMPLETED order (one per order). */
export async function createBuyerReview(orderId: string, seller: User, rating: number, comment?: string) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw Errors.validation({ rating: "Rating must be 1–5" });
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Errors.notFound("Order not found");
  if (order.sellerId !== seller.id && seller.role !== "ADMIN") throw Errors.forbidden();
  if (order.status !== "COMPLETED") throw Errors.conflict("Only completed orders can be reviewed");
  // Same reasoning as createReview: a free test order must not produce a real reputation signal.
  if (order.isTest) throw Errors.conflict("Test orders cannot be reviewed");
  const existing = await prisma.buyerReview.findUnique({ where: { orderId } });
  if (existing) throw Errors.conflict("This order's buyer is already reviewed");

  const review = await prisma.buyerReview.create({
    data: { orderId, buyerId: order.buyerId, rating, comment: comment?.trim() || null },
  });
  await audit({ actorId: seller.id, action: "buyerReview.create", entity: "Order", entityId: orderId });
  return review;
}

export function getOrderBuyerReview(orderId: string) {
  return prisma.buyerReview.findUnique({ where: { orderId } });
}

/** A buyer's reputation (avg rating + count) from sellers' reviews. */
export async function getBuyerRating(buyerId: string) {
  const agg = await prisma.buyerReview.aggregate({
    where: { buyerId },
    _avg: { rating: true },
    _count: true,
  });
  return { avg: agg._avg.rating ?? 0, count: agg._count };
}

/** Reviews for a gig + average/count + star distribution, for the public gig page. */
export async function getGigReviews(gigId: string) {
  // Test orders must never reach a public surface. recomputeSellerStats (profile.ts:22) and
  // browse.ts already filter this; the gig page did not, so a free FREE_ORDERS order could
  // put a 5★ review on a listing — and into the page's structured data (audit 2026-08-10, S3).
  const publicReviews = { gigId, order: { isTest: false } } as const;
  const [reviews, agg, grouped] = await Promise.all([
    prisma.review.findMany({
      where: publicReviews,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { author: { select: { firstName: true, name: true, username: true } } },
    }),
    prisma.review.aggregate({ where: publicReviews, _avg: { rating: true }, _count: true }),
    prisma.review.groupBy({ by: ["rating"], where: publicReviews, _count: true }),
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
