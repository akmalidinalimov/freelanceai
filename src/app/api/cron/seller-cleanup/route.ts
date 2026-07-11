import { expireUnsubmittedSellers, warnExpiringSellers } from "@/server/services/seller-approval";

/**
 * Scheduled job endpoint (daily): revoke the seller capability from users who turned on
 * selling but never completed onboarding (INCOMPLETE + never submitted + older than the
 * grace window). The account is kept as a buyer. Protected by a shared CRON_SECRET (Bearer).
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  // Warn those ~24h out FIRST (so nobody is revoked without a heads-up), then revoke the expired.
  const warned = await warnExpiringSellers();
  const revoked = await expireUnsubmittedSellers();
  return Response.json({ warned, revoked });
}
