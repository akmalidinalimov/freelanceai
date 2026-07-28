import { ok, errorResponse, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { toggleBlockCounterpart } from "@/server/services/moderation-user";

/** Toggle a block on the conversation counterpart (participants only). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    enforceRateLimit(`block:${user.id}`, 20, 60_000);
    const { id } = await params;
    const res = await toggleBlockCounterpart(id, user);
    return ok(res);
  } catch (err) {
    return errorResponse(err);
  }
}
