import { syncChatMenuButtons, countMenuButtonTargets } from "@/server/services/menu-button-backfill";

/**
 * One-off (re-runnable) backfill: push a marked Mini App menu button to every already-paired
 * user, since Telegram stores that button per chat and never refreshes it on its own.
 * CRON_SECRET-guarded like the other maintenance routes. Sends the user nothing.
 *
 * Resume a budget-truncated run by passing the returned nextCursor:
 *   POST /api/cron/menu-button-sync            → { done, nextCursor, ok, failed, blocked }
 *   POST /api/cron/menu-button-sync?cursor=... → continues from there
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const cursor = new URL(request.url).searchParams.get("cursor");
  const total = cursor ? undefined : await countMenuButtonTargets();
  const result = await syncChatMenuButtons({ cursor });
  return Response.json(total === undefined ? result : { total, ...result });
}
