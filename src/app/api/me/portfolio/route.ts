import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { requireSeller } from "@/lib/authz";
import { addPortfolioItem, removePortfolioItem } from "@/server/services/profile";

const addSchema = z
  .object({
    mediaUrl: z.string().url().max(500),
    mediaType: z.enum(["image", "video"]).default("image"),
    caption: z.string().max(140).optional(),
  })
  .strict();

/** Add a portfolio item to the caller's seller profile. */
export const POST = defineHandler({ auth: true, schema: addSchema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();
  requireSeller(user);
  const item = await addPortfolioItem(user.id, body.mediaUrl, body.mediaType, body.caption);
  return ok({ item });
});

const delSchema = z.object({ id: z.string().min(1).max(40) }).strict();

/** Remove one of the caller's portfolio items. */
export const DELETE = defineHandler({ auth: true, schema: delSchema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();
  requireSeller(user);
  await removePortfolioItem(user.id, body.id);
  return ok({ done: true });
});
