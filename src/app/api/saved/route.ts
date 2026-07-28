import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { toggleSaved } from "@/server/services/saved";

const schema = z.object({ gigId: z.string().min(1) }).strict();

/** Toggle a gig in the caller's saved list. */
export const POST = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();
  const saved = await toggleSaved(user.id, body.gigId);
  return ok({ saved });
});
