import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { createOrder } from "@/server/services/order";

const schema = z
  .object({
    gigId: z.string().min(1),
    tier: z.enum(["BASIC", "STANDARD", "PREMIUM"]),
    requirements: z.string().max(3000).optional(),
  })
  .strict();

/** Place an order. Buyer = current user (cannot be the gig's seller). */
export const POST = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();
  const order = await createOrder(user.id, body.gigId, body.tier, body.requirements);
  return ok({ id: order.id });
});
