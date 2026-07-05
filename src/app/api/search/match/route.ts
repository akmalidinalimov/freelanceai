import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok } from "@/lib/api";
import { enforceRateLimit, clientIp } from "@/lib/rate-limit";
import { matchCreators, matchGigs } from "@/server/services/match";

const schema = z
  .object({
    query: z.string().min(1).max(300),
    limit: z.number().int().min(1).max(24).optional(),
    locale: z.enum(["uz", "ru", "en"]).optional(),
    // Gig-first is the default surface (Fiverr model); "creators" is the secondary view.
    mode: z.enum(["gigs", "creators"]).optional(),
  })
  .strict();

/** Public AI-match search: describe a job → ranked gigs (default) or creators.
 * Same-origin, rate-limited. */
export const POST = defineHandler({ schema, sameOrigin: true }, async ({ user, body, request }) => {
  // This route sets no `auth`, so `user` is always null → key anonymous callers by IP,
  // otherwise the whole site shares one "search:anon" bucket (trivial DoS of the hero).
  enforceRateLimit(`search:${user?.id ?? clientIp(request)}`, 60, 60_000);
  const { intent, results } =
    body.mode === "creators"
      ? await matchCreators(body.query, { limit: body.limit, locale: body.locale })
      : await matchGigs(body.query, { limit: body.limit, locale: body.locale });
  return ok({ intent, results });
});
