import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { createBroadcast, countRecipients, processBroadcasts } from "@/server/services/broadcast";

const schema = z
  .object({
    message: z.string().min(3).max(3000),
    audience: z.enum(["ALL", "BUYERS", "SELLERS", "ACTIVE_30D"]),
    // ISO datetime for a scheduled send; omit / past = send now.
    scheduledFor: z.string().datetime().optional(),
  })
  .strict();

/** Admin-only: queue a Telegram broadcast (now or scheduled) + kick delivery for instant sends. */
export const POST = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user || user.role !== "ADMIN") throw Errors.forbidden("Admins only");
  const when = body.scheduledFor ? new Date(body.scheduledFor) : null;
  const { broadcast, scheduled } = await createBroadcast(user, body.message, body.audience, when);
  const recipients = await countRecipients(body.audience);
  // Immediate sends drain now; scheduled ones wait for the cron to reach their time.
  if (!scheduled) void processBroadcasts().catch(() => {});
  return ok({ id: broadcast.id, recipients, scheduled, scheduledFor: broadcast.scheduledFor });
});
