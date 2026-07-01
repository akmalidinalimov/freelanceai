import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createOffer } from "@/server/services/offer";

const schema = z
  .object({
    title: z.string().min(1).max(120),
    priceUzs: z.number().int().min(1000).max(100_000_000),
    deliveryDays: z.number().int().min(1).max(90),
    revisions: z.number().int().min(0).max(20),
  })
  .strict();

/** Seller sends a custom offer in a conversation. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    enforceRateLimit(`offer:${user.id}`, 10, 60_000);
    const { id } = await params;
    const input = parseInput(schema, await request.json().catch(() => ({})));
    const offer = await createOffer(user, id, input);
    return ok({ offerId: offer.id });
  } catch (err) {
    return errorResponse(err);
  }
}
