import { sendOrderReminders } from "@/server/services/reminders";

/**
 * Order deadline reminders (2d/1d/overdue → seller) + review nudges (delivered >24h,
 * unreviewed → buyer). Every ~6h. Idempotent per (order, threshold). CRON_SECRET-guarded.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const result = await sendOrderReminders();
  return Response.json(result);
}
