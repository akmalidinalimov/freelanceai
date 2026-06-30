import { autoCompleteDeliveredOrders } from "@/server/services/order";

/**
 * Scheduled job endpoint: auto-complete deliveries the buyer never acted on.
 * Protected by a shared CRON_SECRET (Bearer). Called by .github/workflows/auto-complete.yml.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const completed = await autoCompleteDeliveredOrders(3);
  return Response.json({ completed });
}
