import { sendDailyDigests } from "@/server/services/digest";

/**
 * Daily digest job (see .github/workflows/digest.yml — 13:00 UTC ≈ 18:00 Tashkent,
 * the evening check-phone window). Value-gated: silent unless a user has unread
 * messages or new gigs from followed creators. CRON_SECRET-guarded like the others.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const result = await sendDailyDigests();
  return Response.json(result);
}
