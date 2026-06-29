import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/http";

const TOKEN_TTL_MS = 5 * 60 * 1000;

/**
 * Begin a bot deep-link login. Creates a one-time PENDING token and returns the
 * Telegram deep link the browser should open. No auth required (pre-login).
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    return NextResponse.json({ ok: false, error: "bot_not_configured" }, { status: 500 });
  }

  const token = crypto.randomBytes(24).toString("hex");
  await prisma.loginToken.create({
    data: { token, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });

  return NextResponse.json({
    ok: true,
    data: {
      token,
      deepLink: `https://t.me/${botUsername}?start=${token}`,
    },
  });
}
