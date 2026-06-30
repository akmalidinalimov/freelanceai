import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { acceptOffer, declineOffer } from "@/server/services/offer";

const schema = z.object({ action: z.enum(["accept", "decline"]) }).strict();

/** Buyer accepts (→ order) or either party declines a custom offer. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const { id } = await params;
    const { action } = parseInput(schema, await request.json().catch(() => ({})));
    if (action === "accept") {
      const orderId = await acceptOffer(id, user);
      return ok({ orderId });
    }
    await declineOffer(id, user);
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
