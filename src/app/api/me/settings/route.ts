import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z
  .object({
    notifyTelegram: z.boolean().optional(),
    notifyEmail: z.boolean().optional(),
    notifyPrefs: z
      .object({ orders: z.boolean(), messages: z.boolean(), reviews: z.boolean() })
      .partial()
      .optional(),
  })
  .strict();

/** Update the caller's notification preferences. */
export const PATCH = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();
  await prisma.user.update({ where: { id: user.id }, data: body });
  return ok({ done: true });
});
