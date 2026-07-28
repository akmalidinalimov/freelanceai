import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { toggleFollow } from "@/server/services/follow";

const schema = z.object({ sellerId: z.string().min(1).max(40) }).strict();

/** Toggle following a creator. */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    enforceRateLimit(`follow:${user.id}`, 20, 60_000);
    const { sellerId } = parseInput(schema, await request.json().catch(() => ({})));
    const result = await toggleFollow(user.id, sellerId);
    return ok(result);
  } catch (err) {
    return errorResponse(err);
  }
}
