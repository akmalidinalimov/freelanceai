import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { createCoupon } from "@/server/services/coupon";

const schema = z
  .object({
    code: z.string().min(3).max(24),
    percentOff: z.number().int().min(1).max(100).optional(),
    amountOffUzs: z.number().int().min(1000).max(100_000_000).optional(),
    maxUses: z.number().int().min(1).max(100_000).optional(),
    expiresAt: z.string().optional(),
  })
  .strict();

/** Admin-only: create a promo code. */
export const POST = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();
  const coupon = await createCoupon(user, body);
  return ok({ id: coupon.id, code: coupon.code });
});
