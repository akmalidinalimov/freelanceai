import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMiniAppInitData, parseInitData } from "@/lib/telegram";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/http";

/**
 * Why a Mini App sign-in failed, in one word, for any user.
 *
 * next-auth collapses every `authorize()` rejection into the same opaque "CredentialsSignin", so a
 * user staring at a failure screen — and whoever they report it to — had nothing to go on. The
 * admin-only diagnostic was worse than nothing here: it answered a non-admin with a 403, which the
 * UI rendered as "E-TG-403", a code about permissions masquerading as a sign-in reason.
 *
 * The response is exactly one enum value and nothing else: no hash, no field list, no token length,
 * no username, no echo of the payload.
 *
 * WHY THIS IS NOT AN ORACLE. Every value except one tells the caller something they could already
 * determine from the payload in their own hand, or by simply attempting to log in:
 *   stale         — auth_date is in the payload they hold
 *   no_user       — so is the absence of a `user` field
 *   server_error  — already visible to them as next-auth's "Configuration"
 *   bad_signature — only that THIS payload's HMAC fails, which a login attempt already reveals;
 *                   the comparison is constant-time and a 256-bit output makes guided search useless
 *
 * `inactive_account` is the single value that would disclose something new — that a given Telegram
 * id has a suspended account here — so it is returned ONLY after the signature verifies. A verified
 * HMAC means the caller IS that Telegram user, making it self-disclosure rather than enumeration.
 * For anything that fails verification we collapse to `bad_signature` and never touch the database.
 */
type Reason = "ok" | "bad_signature" | "stale" | "no_user" | "inactive_account" | "server_error";

const reason = (reason: Reason) => NextResponse.json({ reason });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ reason: "server_error" as Reason }, { status: 403 });
  }
  // A speed bump, not a wall — the limiter is in-memory and per-instance. Keeping the response
  // contentless is what makes that acceptable.
  if (!rateLimit(`tg-reason:${clientIp(request)}`, 20, 60_000)) {
    return NextResponse.json({ reason: "server_error" as Reason }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { initData?: string } | null;
  const initData = typeof body?.initData === "string" ? body.initData : "";
  if (!initData) return reason("no_user");

  const fields = parseInitData(initData);
  if (!fields.user) return reason("no_user");

  // Distinguish stale from forged BEFORE verifying, because a stale payload has a perfectly good
  // signature and calling it "bad_signature" would send everyone hunting the wrong thing.
  const authDate = Number(fields.auth_date);
  if (Number.isFinite(authDate)) {
    const age = Math.floor(Date.now() / 1000) - authDate;
    if (age > 600 || age < -300) return reason("stale");
  }

  let verified: ReturnType<typeof verifyMiniAppInitData>;
  try {
    verified = verifyMiniAppInitData(initData, { maxAgeSeconds: 600 });
  } catch {
    // getBotToken throws when TELEGRAM_BOT_TOKEN is unset — a deployment fault, not the caller's.
    return reason("server_error");
  }
  if (!verified) return reason("bad_signature");

  // Past this line the caller has proved they are this Telegram user, so reporting their own
  // account's state back to them discloses nothing.
  try {
    const account = await prisma.user.findUnique({
      where: { telegramId: verified.id },
      select: { status: true },
    });
    // A missing account is not a failure: the provider upserts one. Only a non-ACTIVE row blocks.
    if (account && account.status !== "ACTIVE") return reason("inactive_account");
  } catch {
    return reason("server_error");
  }

  // Verified, fresh, and eligible — so the rejection was not here. Almost always the csrf race,
  // which the client detects on its own without asking us.
  return reason("ok");
}
