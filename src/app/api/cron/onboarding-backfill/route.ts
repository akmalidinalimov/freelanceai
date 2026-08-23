import { backfillTelegramOnboarding } from "@/server/services/onboarding-backfill";

/**
 * One-time (re-runnable) backfill: mark pre-existing Telegram accounts as onboarded, so /start
 * gives them the welcome and the reply keyboard instead of diverting into a registration form new
 * users no longer see. CRON_SECRET-guarded like the other maintenance routes. Sends nothing.
 *
 *   POST /api/cron/onboarding-backfill  ->  { pending, updated }
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  return Response.json(await backfillTelegramOnboarding());
}
