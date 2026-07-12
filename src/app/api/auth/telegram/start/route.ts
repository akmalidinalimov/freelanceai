import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/http";
import { rateLimit, clientIp, sha256 } from "@/lib/rate-limit";

const TOKEN_TTL_MS = 5 * 60 * 1000;
const NONCE_COOKIE = "fa_login_nonce";

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

  const token = crypto.randomBytes(24).toString("hex");
  const nonce = crypto.randomBytes(24).toString("hex");
  await prisma.loginToken.create({
    data: {
      token,
      browserNonceHash: sha256(nonce),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const res = NextResponse.json({
    ok: true,
    data: { token, deepLink: `https://t.me/${botUsername}?start=${token}` },
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
