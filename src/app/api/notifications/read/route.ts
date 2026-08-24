import { ok, errorResponse, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { markNotificationsRead } from "@/server/services/notification";

/** Mark all of the current user's notifications as read. */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    await markNotificationsRead(user.id);
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
