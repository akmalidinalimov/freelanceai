import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tgSendMessage } from "@/lib/telegram-bot";

/**
 * Telegram bot webhook. Receives updates; handles `/start <loginToken>` by
 * confirming the matching login token with the sender's Telegram identity.
 * Verified via the secret header set when registering the webhook.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let update: {
    message?: {
      text?: string;
      from?: { id: number; first_name?: string; last_name?: string; username?: string };
    };
  };
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  const from = msg?.from;
  const text = msg?.text ?? "";

  if (from && text.startsWith("/start")) {
    const payload = text.split(/\s+/)[1];
    if (!payload) {
      await tgSendMessage(from.id, "Salom! Saytdagi “Telegram orqali kirish” tugmasini bosing.");
      return NextResponse.json({ ok: true });
    }

    const lt = await prisma.loginToken.findUnique({ where: { token: payload } });
    if (lt && lt.status === "PENDING" && lt.expiresAt > new Date()) {
      await prisma.loginToken.update({
        where: { token: payload },
        data: {
          status: "CONFIRMED",
          telegramId: String(from.id),
          firstName: from.first_name,
          lastName: from.last_name,
          username: from.username,
        },
      });
      await tgSendMessage(from.id, "✅ Tasdiqlandi! Saytga qayting — avtomatik kirasiz.");
    } else {
      await tgSendMessage(from.id, "Havola eskirgan. Saytda qaytadan urinib koʻring.");
    }
  }

  return NextResponse.json({ ok: true });
}
