import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok } from "@/lib/api";
import { enforceRateLimit, clientIp } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { CLIENT_EVENT_TYPES, trackEvent } from "@/server/services/activity";

const schema = z
  .object({
    type: z.enum(CLIENT_EVENT_TYPES),
    entityId: z.string().max(64).optional(),
  })
  .strict();

/**
 * Client funnel events (CTA clicks). Anonymous allowed (the funnel starts before
 * login); user attached when present. Conversions (order_created / order_paid) are
 * NEVER accepted here — services write those server-side.
 */
export const POST = defineHandler({ schema, sameOrigin: true }, async ({ body, request }) => {
  const user = await getCurrentUser();
  // Per-caller limit + a global circuit breaker (distributed floods can rotate IPs;
  // events are best-effort analytics, so shedding under attack is the right trade).
  enforceRateLimit(`events:${user?.id ?? clientIp(request)}`, 60, 60_000);
  enforceRateLimit("events:global", 3000, 60_000);
  await trackEvent(body.type, { userId: user?.id, entityId: body.entityId });
  return ok({});
});
