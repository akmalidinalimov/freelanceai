import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/authz";
import { bulkUserAction } from "@/server/services/admin-users";

const schema = z
  .object({
    action: z.enum(["suspend", "unsuspend", "makeSeller", "removeSeller", "creditGrant", "tagCourse", "untagCourse"]),
    userIds: z.array(z.string().min(1).max(40)).min(1).max(200),
    reason: z.string().max(500).optional(),
    amountUzs: z.number().int().positive().optional(),
  })
  .strict();

/**
 * Bulk user actions from the list's selection bar. Deletion and KYC approval are
 * intentionally absent (irreversible / needs per-user review) — see the service.
 */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    requireAdmin(user);
    const { action, userIds, reason, amountUzs } = parseInput(schema, await request.json().catch(() => ({})));
    const result = await bulkUserAction(user, userIds, action, { reason, amountUzs });
    return ok(result);
  } catch (err) {
    return errorResponse(err);
  }
}
