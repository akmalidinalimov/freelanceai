import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  tgSendMessage,
  tgMainKeyboard,
  tgSetChatMenuButton,
  tgWelcome,
  tgHelpText,
} from "@/lib/telegram-bot";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { encryptPII } from "@/lib/pii-crypto";
import { stampTelegramChat } from "@/server/services/activity";
import { routeTelegramReply } from "@/server/services/message";

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
      contact?: { phone_number?: string; user_id?: number };
      reply_to_message?: { message_id?: number };
      chat?: { id?: number; type?: string };
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
  const contact = update.message?.contact;
  const replyToId = update.message?.reply_to_message?.message_id;
  const chatType = update.message?.chat?.type;

  // Any real inbound message stamps "last chatted with the bot" (admin analytics)
  // and clears a stale bot-blocked marker (the user is clearly reachable again).
  if (from && !from.is_bot) {
    stampTelegramChat(String(from.id));
    void prisma.user
      .updateMany({
        where: { telegramId: String(from.id), telegramBlockedAt: { not: null } },
        data: { telegramBlockedAt: null },
      })
      .catch(() => {});
  }

  // KYC phone share: the user tapped the "share phone" button (requestContact). Telegram
  // gives us their already-verified phone. Only accept the user's OWN contact.
  if (from && !from.is_bot && contact?.phone_number) {
    if (contact.user_id === from.id) {
      const res = await prisma.user.updateMany({
        where: { telegramId: String(from.id) },
        data: { phone: encryptPII(contact.phone_number), kycStatus: "VERIFIED" },
      });
      void tgSendMessage(
        from.id,
        res.count > 0 ? "✅ Telefon raqamingiz tasdiqlandi." : "Hisob topilmadi. Avval saytga kiring.",
        { remove_keyboard: true }
      );
    } else {
      void tgSendMessage(from.id, "Iltimos, faqat oʻzingizning kontaktingizni ulashing.", {
        remove_keyboard: true,
      });
    }
    return NextResponse.json({ ok: true });
  }

  // Bot-native quick reply: the user swipe-replied (in Telegram) to a "new message"
  // notification. Route their text back into that conversation as a real message.
  // Gated to PRIVATE chats: message_id is per-chat, so only the DM where we sent the
  // notification can safely map back (a group's colliding message_id must not route).
  if (from && !from.is_bot && chatType === "private" && replyToId && text && !text.startsWith("/")) {
    // Per-user throttle: the global webhook limiter keys on Telegram's IP, not the
    // end user, so bound how fast one user can post via replies.
    if (!rateLimit(`tg-reply:${from.id}`, 20, 60_000)) {
      void tgSendMessage(from.id, "⏳ Juda tez yubordingiz. Biroz kuting.");
      return NextResponse.json({ ok: true });
    }
    try {
      const convoId = await routeTelegramReply(String(from.id), replyToId, text);
      if (convoId) {
        void tgSendMessage(from.id, "✅ Javobingiz yuborildi.");
        return NextResponse.json({ ok: true });
      }
      // No mapping (reply to a non-notification message) → fall through as ordinary text.
    } catch {
      // Routing failed after we already marked this update processed (so Telegram
      // won't retry) — tell the user instead of silently dropping their message.
      void tgSendMessage(from.id, "⚠️ Javobni yuborib boʻlmadi. Iltimos, ilovada urinib koʻring.");
      return NextResponse.json({ ok: true });
    }
  }

  if (from && !from.is_bot && (text.startsWith("/start") || text === "/menu" || text === "/help")) {
    // Load the user (locale + seller capability) to render the right keyboard.
    const account = await prisma.user.findUnique({
      where: { telegramId: String(from.id) },
      select: { firstName: true, locale: true, isSeller: true },
    });
    const locale = account?.locale;
    const name = account?.firstName ?? from.first_name;

    // /start with a login-token payload: confirm the web deep-link login.
    const payload = text.startsWith("/start") ? text.split(/\s+/)[1] : undefined;
    if (payload) {
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
      if (confirmed.count > 0) {
        void tgSendMessage(from.id, "✅ Tasdiqlandi! Saytga qayting — avtomatik kirasiz.");
      }
    }

    if (text === "/help") {
      void tgSendMessage(from.id, tgHelpText(locale));
    } else {
      // Welcome + the always-visible role-aware keyboard + Menu Button → Mini App.
      void tgSetChatMenuButton(from.id, locale);
      void tgSendMessage(from.id, tgWelcome(locale, name), tgMainKeyboard(locale, account?.isSeller ?? false));
    }
    return NextResponse.json({ ok: true });
  }

  // Help reply-keyboard button (any-locale "ℹ️ …" label) → help text.
  if (from && !from.is_bot && /^ℹ️/.test(text)) {
    const account = await prisma.user.findUnique({
      where: { telegramId: String(from.id) },
      select: { locale: true },
    });
    void tgSendMessage(from.id, tgHelpText(account?.locale));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
