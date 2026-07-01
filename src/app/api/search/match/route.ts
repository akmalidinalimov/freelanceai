import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { matchCreators } from "@/server/services/match";

const schema = z
  .object({
    query: z.string().min(1).max(300),
    limit: z.number().int().min(1).max(20).optional(),
    locale: z.enum(["uz", "ru", "en"]).optional(),
  })
  .strict();

/** Public AI-match search: describe a job → ranked creators. Same-origin, rate-limited. */
export const POST = defineHandler({ schema, sameOrigin: true }, async ({ user, body }) => {
  enforceRateLimit(`search:${user?.id ?? "anon"}`, 60, 60_000);
  const { intent, results } = await matchCreators(body.query, {
    limit: body.limit,
    locale: body.locale,
  });
  return ok({ intent, results });
});
