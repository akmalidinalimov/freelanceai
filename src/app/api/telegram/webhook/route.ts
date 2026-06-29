import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tgSendMessage } from "@/lib/telegram-bot";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Telegram bot webhook. Verified by the secret header. Idempotent (dedups on
 * update_id — Telegram retries), ignores bot senders, and confirms a login token
 * with a single conditional update.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  if (!rateLimit(`tg-webhook:${clientIp(request)}`, 120, 60_000)) {
    return NextResponse.json({ ok: true }); // drop quietly under flood
  }

  let update: {
    update_id?: number;
    message?: {
      text?: string;
      from?: {
        id: number;
        is_bot?: boolean;
        first_name?: string;
        last_name?: string;
        username?: string;
      };
    };
  };
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Idempotency: process each update_id once.
  if (typeof update.update_id === "number") {
    try {
      await prisma.processedUpdate.create({ data: { updateId: BigInt(update.update_id) } });
    } catch {
      return NextResponse.json({ ok: true }); // already processed
    }
  }

  const from = update.message?.from;
  const text = update.message?.text ?? "";

  if (from && !from.is_bot && text.startsWith("/start")) {
    const payload = text.split(/\s+/)[1];
    if (!payload) {
      void tgSendMessage(from.id, "Salom! Saytdagi “Telegram orqali kirish” tugmasini bosing.");
      return NextResponse.json({ ok: true });
    }

    // Single-shot confirm: only a still-PENDING, unexpired token is claimed.
    const confirmed = await prisma.loginToken.updateMany({
      where: { token: payload, status: "PENDING", expiresAt: { gt: new Date() } },
      data: {
        status: "CONFIRMED",
        telegramId: String(from.id),
        firstName: from.first_name,
        lastName: from.last_name,
        username: from.username,
      },
    });
    void tgSendMessage(
      from.id,
      confirmed.count > 0
        ? "✅ Tasdiqlandi! Saytga qayting — avtomatik kirasiz."
        : "Havola eskirgan. Saytda qaytadan urinib koʻring."
    );
  }

  return NextResponse.json({ ok: true });
}
