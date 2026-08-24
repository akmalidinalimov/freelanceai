import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { createReview } from "@/server/services/review";

const schema = z
  .object({
    orderId: z.string().min(1),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(2000).optional(),
  })
  .strict();

/** Buyer leaves a review on a completed order. */
export const POST = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();
  const review = await createReview(user.id, body.orderId, body.rating, body.comment);
  return ok({ id: review.id });
});
