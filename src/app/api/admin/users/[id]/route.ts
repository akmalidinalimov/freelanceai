import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { setUserStatus, setUserSeller, setUserKyc, adminDeleteUser } from "@/server/services/admin-users";

const schema = z
  .object({
    action: z.enum(["suspend", "unsuspend", "makeSeller", "removeSeller", "kycApprove", "kycReject", "delete"]),
    // Deletion is irreversible (anonymize-and-close) — require typed confirmation.
    confirm: z.string().optional(),
  })
  .strict();

/** Admin user actions: suspend / unsuspend / toggle seller / KYC / delete. Never changes role
 * (ADMIN is allowlist-only by design — no UI path may grant it). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const { id } = await params;
    const { action, confirm } = parseInput(schema, await request.json().catch(() => ({})));
    if (action === "suspend") await setUserStatus(user, id, true);
    else if (action === "unsuspend") await setUserStatus(user, id, false);
    else if (action === "makeSeller") await setUserSeller(user, id, true);
    else if (action === "removeSeller") await setUserSeller(user, id, false);
    else if (action === "kycApprove") await setUserKyc(user, id, "VERIFIED");
    else if (action === "kycReject") await setUserKyc(user, id, "REJECTED");
    else {
      if (confirm !== "DELETE") throw Errors.validation({ confirm: 'Type "DELETE" to confirm' });
      await adminDeleteUser(user, id);
    }
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
