import { autoCompleteDeliveredOrders, expireStalePendingOrders } from "@/server/services/order";
import { checkSavedSearches } from "@/server/services/saved-search";

/**
 * Scheduled job endpoint (every ~6h): auto-complete stale deliveries + notify users about
 * new gigs matching their saved searches. Protected by a shared CRON_SECRET (Bearer).
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const completed = await autoCompleteDeliveredOrders(3);
  const expired = await expireStalePendingOrders(48).catch(() => 0);
  const searchAlerts = await checkSavedSearches().catch(() => 0);
  return Response.json({ completed, expired, searchAlerts });
}
