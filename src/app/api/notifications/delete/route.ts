import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { deleteNotification, clearNotifications } from "@/server/services/notification";

const schema = z.object({ id: z.string().min(1).max(40).optional() }).strict();

/** Delete one notification (with `id`) or all of them (no `id`). Owner-scoped. */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const { id } = parseInput(schema, await request.json().catch(() => ({})));
    if (id) await deleteNotification(user.id, id);
    else await clearNotifications(user.id);
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
