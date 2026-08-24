import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { isAdminTelegramId } from "@/lib/roles";
import { verifyMiniAppInitData, parseInitData, safeHexEqual } from "@/lib/telegram";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/http";
import { prisma } from "@/lib/prisma";

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
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!rateLimit(`tg-debug:${clientIp(request)}`, 20, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { initData?: string } | null;
  const initData = typeof body?.initData === "string" ? body.initData : "";
  if (!initData) return NextResponse.json({ error: "no initData" }, { status: 400 });

  // Same parser as the verifier, so the diagnostic can never disagree with it.
  const fields = parseInitData(initData);

  let claimedId = "";
  try {
    claimedId = String((JSON.parse(fields.user ?? "{}") as { id?: unknown }).id ?? "");
  } catch {
    /* reported below as hasUser:false */
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

  // Run the REAL verifier and the REAL account lookup, not a re-implementation. Every input to
  // the signature has now been checked and found correct — the bot token belongs to the right bot,
  // the check string excludes hash and signature, the payload is seconds old — so whatever is
  // rejecting sign-in happens AFTER verification, and only the actual code path can show it.
  const verified = verifyMiniAppInitData(initData, { maxAgeSeconds: 600 });

  // Admin gate AFTER verification, on the VERIFIED id. Gating on the claimed id let anyone probe
  // ADMIN_TELEGRAM_IDS by watching the response shape change; requiring a valid signature first
  // means only the real Telegram account can ask, so the answer tells them only about themselves.
  // Everyone else gets the coarse reason endpoint, which is what the sign-in screen already calls.
  if (!verified || !isAdminTelegramId(verified.id, process.env.ADMIN_TELEGRAM_IDS)) {
    return NextResponse.json({ reason: "see /api/telegram/initdata-reason" });
  }
  const account = verified
    ? await prisma.user.findUnique({
        where: { telegramId: verified.id },
        select: { id: true, status: true, username: true, telegramId: true },
      })
    : null;

  return NextResponse.json({
    // The decisive line: what the provider itself would do with this payload.
    verifierAccepts: verified !== null,
    accountExists: account !== null,
    accountStatus: account?.status ?? null,
    // `authorize` returns null for anything other than ACTIVE, which looks identical to a bad
    // signature from the client. This is the one that separates them.
    wouldSignIn: verified !== null && account !== null && account.status === "ACTIVE",
    accountUsername: account?.username ?? null,
    botTokenConfigured: Boolean(botToken),
    botTokenLength: botToken.length, // a truncated or quoted env var is the classic cause
    hashPresent: Boolean(fields.hash),
    // safeHexEqual, matching the production verifier's constant-time standard rather than ===.
    hashMatches: safeHexEqual(computed, fields.hash ?? ""),
    signaturePresentAndExcluded: Boolean(fields.signature),
    fieldsInCheckString: Object.keys(fields).filter((k) => k !== "hash" && k !== "signature").sort(),
    ageSeconds,
    freshWithin600s: ageSeconds !== null && ageSeconds >= 0 && ageSeconds < 600,
    hasUser: Boolean(fields.user),
    claimedId,
  });
}
