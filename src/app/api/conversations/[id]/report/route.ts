import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { reportCounterpart } from "@/server/services/moderation-user";

const schema = z.object({ reason: z.string().min(3).max(1000) }).strict();

/** Report the conversation counterpart to admin moderation (participants only). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    enforceRateLimit(`report:${user.id}`, 10, 60_000);
    const { id } = await params;
    const { reason } = parseInput(schema, await request.json().catch(() => ({})));
    await reportCounterpart(id, user, reason);
    return ok({ reported: true });
  } catch (err) {
    return errorResponse(err);
  }
}
