import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/authz";
import { approveSeller, rejectSeller } from "@/server/services/admin-sellers";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), profileId: z.string().min(1).max(40) }),
  z.object({ action: z.literal("reject"), profileId: z.string().min(1).max(40), reason: z.string().min(1).max(500) }),
]);

/** Admin seller approval: approve / reject a pending seller. */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    requireAdmin(user); // defense-in-depth: don't rely solely on the service-layer role check
    const input = parseInput(schema, await request.json().catch(() => ({})));
    if (input.action === "approve") {
      await approveSeller(user, input.profileId);
    } else {
      await rejectSeller(user, input.profileId, input.reason);
    }
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
