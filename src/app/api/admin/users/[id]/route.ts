import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/authz";
import {
  setUserStatus,
  setUserSeller,
  setUserKyc,
  adminDeleteUser,
  adjustUserCredit,
  updateUserIdentity,
} from "@/server/services/admin-users";

const schema = z
  .object({
    action: z.enum([
      "suspend",
      "unsuspend",
      "makeSeller",
      "removeSeller",
      "kycApprove",
      "kycReject",
      "creditAdjust",
      "updateIdentity",
      "delete",
    ]),
    // updateIdentity only. Auth identities (email / telegramId) are deliberately
    // NOT editable — they are login credentials.
    firstName: z.string().max(60).optional(),
    lastName: z.string().max(60).optional(),
    username: z.string().max(40).optional(),
    locale: z.enum(["uz", "ru", "en"]).optional(),
    // Suspension reason (optional) — audited and included in the user's notice.
    reason: z.string().max(500).optional(),
    // creditAdjust only: signed UZS delta (grant positive, claw back negative).
    amountUzs: z.number().int().optional(),
    // Deletion is irreversible (anonymize-and-close) — require typed confirmation.
    confirm: z.string().optional(),
  })
  .strict();

/** Admin user actions: suspend / unsuspend / toggle seller / KYC / credit / delete. Never
 * changes role (ADMIN is allowlist-only by design — no UI path may grant it). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    requireAdmin(user); // defense-in-depth alongside the service-layer role check
    const { id } = await params;
    const body = parseInput(schema, await request.json().catch(() => ({})));
    const { action, reason, amountUzs, confirm } = body;
    if (action === "suspend") await setUserStatus(user, id, true, reason);
    else if (action === "unsuspend") await setUserStatus(user, id, false);
    else if (action === "makeSeller") await setUserSeller(user, id, true);
    else if (action === "removeSeller") await setUserSeller(user, id, false);
    else if (action === "kycApprove") await setUserKyc(user, id, "VERIFIED");
    else if (action === "kycReject") await setUserKyc(user, id, "REJECTED");
    else if (action === "updateIdentity") {
      await updateUserIdentity(user, id, {
        ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
        ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
        ...(body.username !== undefined ? { username: body.username } : {}),
        ...(body.locale !== undefined ? { locale: body.locale } : {}),
      });
    } else if (action === "creditAdjust") {
      if (typeof amountUzs !== "number") throw Errors.validation({ amountUzs: "Amount is required" });
      const newBalanceUzs = await adjustUserCredit(user, id, amountUzs, reason ?? "");
      return ok({ done: true, newBalanceUzs });
    } else {
      if (confirm !== "DELETE") throw Errors.validation({ confirm: 'Type "DELETE" to confirm' });
      await adminDeleteUser(user, id);
    }
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
