import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { fulfillPayoutRequest } from "@/server/services/payments";

const schema = z.object({ requestId: z.string().min(1).max(40) }).strict();

/** Admin fulfils a seller's payout request (REQUESTED → PAID + ledger). Admin check in the service. */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const { requestId } = parseInput(schema, await request.json().catch(() => ({})));
    await fulfillPayoutRequest(user, requestId);
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
