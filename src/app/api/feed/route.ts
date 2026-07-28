import { defineHandler } from "@/lib/handler";
import { ok } from "@/lib/api";
import { enforceRateLimit, clientIp } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { buildFeed } from "@/server/services/engagement";

/**
 * Personalized feed modules (followed / for-you / trending). Auth OPTIONAL —
 * anonymous callers get the trending module only.
 */
export const GET = defineHandler({}, async ({ request }) => {
  const user = await getCurrentUser(); // optional — defineHandler auth would 401
  enforceRateLimit(`feed:${user?.id ?? clientIp(request)}`, 60, 60_000);
  const feed = await buildFeed(user?.id ?? null);
  return ok(feed);
});
