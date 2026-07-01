import { instagramCronPass } from "@/server/services/instagram-sync";

/**
 * Scheduled job: refresh Instagram tokens nearing expiry (~60d lifetime) and re-sync
 * every connected creator's portfolio. Protected by the shared CRON_SECRET (Bearer).
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const result = await instagramCronPass();
  return Response.json(result);
}
