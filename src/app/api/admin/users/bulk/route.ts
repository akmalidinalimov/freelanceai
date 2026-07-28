import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/authz";
import { bulkUserAction } from "@/server/services/admin-users";

const schema = z
  .object({
    action: z.enum([
      "suspend",
      "unsuspend",
      "makeSeller",
      "removeSeller",
      "creditGrant",
      "tagCourse",
      "untagCourse",
      "delete",
    ]),
    userIds: z.array(z.string().min(1).max(40)).min(1).max(200),
    reason: z.string().max(500).optional(),
    amountUzs: z.number().int().positive().optional(),
    // Deletion is irreversible (anonymize-and-close) — require typed confirmation, the
    // same gate the single-user delete uses.
    confirm: z.string().optional(),
  })
  .strict();

/**
 * Bulk user actions from the list's selection bar. `delete` anonymizes-and-closes each
 * account behind a typed confirmation; users with a live order or an unwithdrawn balance
 * come back in `skipped`. KYC approval stays absent — each one needs its phone reviewed.
 */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    requireAdmin(user);
    const { action, userIds, reason, amountUzs, confirm } = parseInput(
      schema,
      await request.json().catch(() => ({}))
    );
    if (action === "delete" && confirm !== "DELETE") {
      throw Errors.validation({ confirm: 'Type "DELETE" to confirm' });
    }
    const result = await bulkUserAction(user, userIds, action, { reason, amountUzs });
    return ok(result);
  } catch (err) {
    return errorResponse(err);
  }
}
