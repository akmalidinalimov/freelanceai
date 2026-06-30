import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import {
  pauseGig,
  resumeGig,
  softDeleteGig,
  approveGig,
  rejectGig,
  reportGig,
} from "@/server/services/gig";

const schema = z
  .object({ action: z.enum(["pause", "resume", "delete", "approve", "reject", "report"]) })
  .strict();

/** Owner gig management + admin moderation (approve/reject) + report. Authz enforced in the service. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const { id } = await params;
    const { action } = parseInput(schema, await request.json().catch(() => ({})));
    if (action === "pause") await pauseGig(id, user);
    else if (action === "resume") await resumeGig(id, user);
    else if (action === "delete") await softDeleteGig(id, user);
    else if (action === "approve") await approveGig(id, user);
    else if (action === "reject") await rejectGig(id, user);
    else await reportGig(id, user);
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
