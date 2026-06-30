import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { tipOrder } from "@/server/services/payments";

const schema = z.object({ amountUzs: z.number().int().min(1000).max(10_000_000) }).strict();

/** Buyer tips the seller on a completed order. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const { id } = await params;
    const input = parseInput(schema, await request.json().catch(() => ({})));
    await tipOrder(id, user, input.amountUzs);
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
