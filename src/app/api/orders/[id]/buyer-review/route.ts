import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { createBuyerReview } from "@/server/services/review";

const schema = z
  .object({ rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() })
  .strict();

/** Seller reviews the buyer on a completed order. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const { id } = await params;
    const input = parseInput(schema, await request.json().catch(() => ({})));
    await createBuyerReview(id, user, input.rating, input.comment);
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
