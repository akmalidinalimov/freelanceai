import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/authz";
import { resolveDispute } from "@/server/services/dispute";

const schema = z
  .object({ resolution: z.enum(["refund", "release"]), note: z.string().max(1000).optional() })
  .strict();

/** Admin resolves a dispute (refund → ledger reversal + CANCELLED, or release → COMPLETED). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    requireAdmin(user);
    const { id } = await params;
    const { resolution, note } = parseInput(schema, await request.json().catch(() => ({})));
    await resolveDispute(id, user, resolution, note);
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
