import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { requireSeller } from "@/lib/authz";
import { presignUpload } from "@/lib/media";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const schema = z
  .object({
    prefix: z.enum(["gigs", "portfolio"]),
    contentType: z.string().min(3).max(100),
    size: z.number().int().positive(),
  })
  .strict();

/** Issue a presigned R2 upload URL for an active seller. */
export const POST = defineHandler({ auth: true, schema }, async ({ user, body, request }) => {
  if (!user) throw Errors.unauthenticated();
  requireSeller(user);
  if (!rateLimit(`media:${clientIp(request)}`, 30, 60_000)) {
    throw Errors.rateLimited();
  }
  try {
    const result = await presignUpload(body.prefix, body.contentType, body.size);
    return ok(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "unsupported_type" || msg === "too_large") {
      throw Errors.validation({ file: msg });
    }
    throw Errors.internal("media_unavailable");
  }
});
