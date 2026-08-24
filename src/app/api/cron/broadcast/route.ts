import { processBroadcasts } from "@/server/services/broadcast";

/**
 * Drain queued admin broadcasts (throttled, resumable). Hourly backstop for the
 * immediate drain kicked off at create time. CRON_SECRET-guarded.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const result = await processBroadcasts();
  return Response.json(result);
}
