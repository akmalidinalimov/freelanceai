import { ok, errorResponse, Errors } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import { listNotifications, countUnreadNotifications } from "@/server/services/notification";

export const dynamic = "force-dynamic";

/** The current user's recent notifications + unread count (for the header bell). */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const [items, unread] = await Promise.all([
      listNotifications(user.id),
      countUnreadNotifications(user.id),
    ]);
    return ok({ items, unread });
  } catch (err) {
    return errorResponse(err);
  }
}
