import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { requireAdmin } from "@/lib/authz";
import { recordPayout } from "@/server/services/payments";

const schema = z
  .object({
    sellerId: z.string().min(1),
    amountUzs: z.number().int().positive(),
    cardMasked: z.string().min(4).max(40),
    note: z.string().max(500).optional(),
  })
  .strict();

/** Admin records a manual payout to a seller (posts the balanced ledger). */
export const POST = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();
  requireAdmin(user);
  await recordPayout(user, body.sellerId, body.amountUzs, body.cardMasked, body.note);
  return ok({ done: true });
});
