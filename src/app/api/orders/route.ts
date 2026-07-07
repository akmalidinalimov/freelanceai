import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createOrder } from "@/server/services/order";

const schema = z
  .object({
    gigId: z.string().min(1),
    tier: z.enum(["BASIC", "STANDARD", "PREMIUM"]),
    requirements: z.string().max(3000).optional(),
    requirementFileUrls: z.array(z.string().url()).max(10).optional(),
    extraIds: z.array(z.string().min(1).max(40)).max(6).optional(),
    couponCode: z.string().max(24).optional(),
    requirementAnswers: z
      .array(z.object({ q: z.string().max(200), a: z.string().max(1000) }))
      .max(8)
      .optional(),
  })
  .strict();

/** Place an order. Buyer = current user (cannot be the gig's seller). */
export const POST = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();
  // Bound order placement per buyer (esp. important in free test mode, where an order costs
  // nothing to place — stops scripted floods that would spam sellers / churn the DB).
  enforceRateLimit(`order:create:${user.id}`, 8, 60_000);
  const order = await createOrder(
    user.id,
    body.gigId,
    body.tier,
    body.requirements,
    body.requirementFileUrls ?? [],
    body.extraIds ?? [],
    body.couponCode,
    body.requirementAnswers ?? []
  );
  return ok({ id: order.id });
});
