import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { isAdminTelegramId } from "@/lib/roles";

/**
 * Says WHICH initData check fails, because NextAuth cannot.
 *
 * Any `authorize()` returning null surfaces as the same opaque "CredentialsSignin", so a valid-
 * looking initData that still will not sign a user in is undiagnosable from the client. Measured
 * on tdesktop 9.6: initData present, 577 chars, 4s old, marker cookie now persisting — and the
 * session still signed out. That leaves the HMAC, the freshness window, and the user payload, and
 * this separates them.
 *
 * Disclosure is deliberately near-zero: the caller already holds the initData, so learning whether
 * their own copy validates tells them nothing they could not find by attempting a login. Restricted
 * to the CLAIMED admin ids anyway, and it never echoes the payload, the hash, or the bot token.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { initData?: string } | null;
  const initData = typeof body?.initData === "string" ? body.initData : "";
  if (!initData) return NextResponse.json({ error: "no initData" }, { status: 400 });

  const params = new URLSearchParams(initData);
  const fields: Record<string, string> = {};
  for (const [k, v] of params.entries()) fields[k] = v;

  // Gate on the CLAIMED id. Unverified by definition — that is the point, since a failing HMAC is
  // what we are here to detect — but it keeps the endpoint useless to anyone but us.
  let claimedId = "";
  try {
    claimedId = String((JSON.parse(fields.user ?? "{}") as { id?: unknown }).id ?? "");
  } catch {
    /* reported below as hasUser:false */
  }
  if (!claimedId || !isAdminTelegramId(claimedId, process.env.ADMIN_TELEGRAM_IDS)) {
    return NextResponse.json({ error: "not an admin id" }, { status: 403 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const dataCheckString = Object.keys(fields)
    .filter((k) => k !== "hash" && k !== "signature")
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const computed = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");

  const authDate = Number(fields.auth_date);
  const ageSeconds = authDate ? Math.floor(Date.now() / 1000) - authDate : null;

  return NextResponse.json({
    botTokenConfigured: Boolean(botToken),
    botTokenLength: botToken.length, // a truncated or quoted env var is the classic cause
    hashPresent: Boolean(fields.hash),
    hashMatches: computed === fields.hash,
    signaturePresentAndExcluded: Boolean(fields.signature),
    fieldsInCheckString: Object.keys(fields).filter((k) => k !== "hash" && k !== "signature").sort(),
    ageSeconds,
    freshWithin600s: ageSeconds !== null && ageSeconds >= 0 && ageSeconds < 600,
    hasUser: Boolean(fields.user),
    claimedId,
  });
}
