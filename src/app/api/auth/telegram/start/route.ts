import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/http";
import { rateLimit, clientIp, sha256 } from "@/lib/rate-limit";

// 2 minutes: the pairing code is only useful while the user is actively looking at both
// screens, and a shorter window shrinks what a forwarded link is worth (audit S4).
const TOKEN_TTL_MS = 2 * 60 * 1000;
const NONCE_COOKIE = "fa_login_nonce";

/**
 * Human-comparable pairing code, e.g. "KF-73". No 0/O/1/I/L — this gets read off one screen
 * and matched against another, sometimes on a cracked phone in bad light.
 */
function pairingCode(): string {
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const pick = (set: string, n: number) =>
    Array.from(crypto.randomBytes(n)).map((b) => set[b % set.length]).join("");
  return `${pick(letters, 2)}-${pick(digits, 2)}`;
}

/**
 * Begin a bot deep-link login. Issues a one-time token AND a browser-binding nonce
 * (httpOnly cookie + its hash stored on the token) so the session can only be claimed
 * by the browser that started login. Rate-limited per IP.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!rateLimit(`tg-start:${clientIp(request)}`, 10, 60_000)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    return NextResponse.json({ ok: false, error: "bot_not_configured" }, { status: 500 });
  }

  // Opportunistic cleanup of expired tokens (cheap; a scheduled purge comes with the worker).
  prisma.loginToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});

  // Locale is cosmetic (it only picks the bot prompt's language), so an unknown value is
  // simply ignored rather than rejected.
  const body = (await request.json().catch(() => ({}))) as { locale?: unknown };
  const locale = ["uz", "ru", "en"].includes(String(body.locale)) ? String(body.locale) : "uz";

  const token = crypto.randomBytes(24).toString("hex");
  const nonce = crypto.randomBytes(24).toString("hex");
  const code = pairingCode();
  await prisma.loginToken.create({
    data: {
      token,
      browserNonceHash: sha256(nonce),
      pairingCode: code,
      locale,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const res = NextResponse.json({
    ok: true,
    data: { token, pairingCode: code, deepLink: `https://t.me/${botUsername}?start=${token}` },
  });
  res.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_TTL_MS / 1000,
  });
  return res;
}
