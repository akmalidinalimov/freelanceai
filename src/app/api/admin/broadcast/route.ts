import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { createBroadcast, countRecipients, processBroadcasts } from "@/server/services/broadcast";

const schema = z
  .object({
    message: z.string().min(3).max(3000),
    audience: z.enum(["ALL", "BUYERS", "SELLERS", "ACTIVE_30D"]),
  })
  .strict();

/** Admin-only: queue a Telegram broadcast + kick off delivery (cron is the backstop). */
export const POST = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user || user.role !== "ADMIN") throw Errors.forbidden("Admins only");
  const b = await createBroadcast(user, body.message, body.audience);
  const recipients = await countRecipients(body.audience);
  // Best-effort immediate drain; the order-of-magnitude of sends is small today and
  // the throttled cron resumes anything left over.
  void processBroadcasts().catch(() => {});
  return ok({ id: b.id, recipients });
});
