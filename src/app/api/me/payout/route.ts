import { ok, errorResponse, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { requestPayout } from "@/server/services/payments";

/** Seller requests a withdrawal of their available balance. */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    if (!user.isSeller) throw Errors.forbidden("Sellers only");
    const req = await requestPayout(user);
    return ok({ requested: true, amountUzs: req.amountUzs });
  } catch (err) {
    return errorResponse(err);
  }
}
