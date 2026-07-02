import crypto from "crypto";
import { instagramCronPass } from "@/server/services/instagram-sync";

/** Constant-time bearer check (avoids leaking the secret via response timing). */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(auth);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Scheduled job: refresh Instagram tokens nearing expiry (~60d lifetime) and re-sync
 * every connected creator's portfolio. Protected by the shared CRON_SECRET (Bearer).
 */
export async function POST(request: Request) {
  if (!authorized(request)) return new Response("unauthorized", { status: 401 });
  const result = await instagramCronPass();
  return Response.json(result);
}
