import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { requestCancellation, respondCancellation } from "@/server/services/cancellation";

const schema = z
  .object({ action: z.enum(["request", "approve", "decline"]), reason: z.string().max(1000).optional() })
  .strict();

/** Request a mutual cancellation, or (other party / admin) approve / decline it. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const { id } = await params;
    const input = parseInput(schema, await request.json().catch(() => ({})));
    if (input.action === "request") await requestCancellation(id, user, input.reason ?? "");
    else await respondCancellation(id, user, input.action === "approve");
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
