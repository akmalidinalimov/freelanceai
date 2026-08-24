import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { addSellerReply } from "@/server/services/review";

const schema = z.object({ response: z.string().min(1).max(1000) }).strict();

/** Seller replies to a review on their gig. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const { id } = await params;
    const { response } = parseInput(schema, await request.json().catch(() => ({})));
    await addSellerReply(id, user, response);
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
