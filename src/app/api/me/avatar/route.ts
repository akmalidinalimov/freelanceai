import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isOwnUpload } from "@/lib/media";

const schema = z.object({ photoUrl: z.string().min(1).max(500).nullable() }).strict();

/** Set or clear the caller's avatar. Any active user (buyer or seller). */
export const PATCH = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();
  // Only our own R2 upload may be set (never an arbitrary external URL); null clears it.
  if (body.photoUrl !== null && !isOwnUpload(body.photoUrl)) {
    throw Errors.validation({ photoUrl: "Only an uploaded image is allowed" });
  }
  await prisma.user.update({ where: { id: user.id }, data: { photoUrl: body.photoUrl } });
  return ok({ done: true });
});
