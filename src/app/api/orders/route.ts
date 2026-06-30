import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { createOrder } from "@/server/services/order";

const schema = z
  .object({
    gigId: z.string().min(1),
    tier: z.enum(["BASIC", "STANDARD", "PREMIUM"]),
    requirements: z.string().max(3000).optional(),
    requirementFileUrls: z.array(z.string().url()).max(10).optional(),
    extraIds: z.array(z.string().min(1).max(40)).max(6).optional(),
    couponCode: z.string().max(24).optional(),
  })
  .strict();

/** Place an order. Buyer = current user (cannot be the gig's seller). */
export const POST = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();
  const order = await createOrder(
    user.id,
    body.gigId,
    body.tier,
    body.requirements,
    body.requirementFileUrls ?? [],
    body.extraIds ?? [],
    body.couponCode
  );
  return ok({ id: order.id });
});
