import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  tgSendMessage,
  tgMainKeyboard,
  tgSetChatMenuButton,
  tgWelcome,
  tgHelpText,
  tgOpenButton,
  tgAnswerCallback,
  tgSetChatCommands,
  ADMIN_BOT_COMMANDS,
} from "@/lib/telegram-bot";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { encryptPII } from "@/lib/pii-crypto";
import { stampTelegramChat } from "@/server/services/activity";
import { routeTelegramReply } from "@/server/services/message";
import { acceptOrder, requestRevision } from "@/server/services/order";
import { createReview } from "@/server/services/review";
import { approveGig, rejectGig } from "@/server/services/gig";
import { isAdminTelegramId } from "@/lib/roles";
import { getAdminStats, getAdminPendingCounts } from "@/server/services/analytics";

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
    callback_query?: {
      id: string;
      data?: string;
      from?: { id: number; is_bot?: boolean };
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

  // Inline action buttons (accept/revise a delivery, rate an order) tapped in the chat.
  // Each service call re-checks ownership, so a user can only act on their OWN orders.
  const cb = update.callback_query;
  if (cb && cb.from && !cb.from.is_bot) {
    const cbFrom = String(cb.from.id);
    if (!rateLimit(`tg-cb:${cbFrom}`, 30, 60_000)) {
      void tgAnswerCallback(cb.id, "Juda tez. Biroz kuting.");
      return NextResponse.json({ ok: true });
    }
    const account = await prisma.user.findFirst({ where: { telegramId: cbFrom, status: "ACTIVE" } });
    if (!account) {
      void tgAnswerCallback(cb.id, "Avval saytga kiring.");
      return NextResponse.json({ ok: true });
    }
    const data = cb.data ?? "";
    try {
      if (data.startsWith("o:acc:")) {
        await acceptOrder(data.slice(6), account);
        void tgAnswerCallback(cb.id, "✅ Buyurtma qabul qilindi!");
      } else if (data.startsWith("o:rev:")) {
        await requestRevision(data.slice(6), account);
        void tgAnswerCallback(cb.id, "✏️ Oʻzgartirish soʻraldi.");
      } else if (data.startsWith("r:")) {
        const [, orderId, n] = data.split(":");
        await createReview(account.id, orderId ?? "", Number(n));
        void tgAnswerCallback(cb.id, `⭐ ${Number(n)} — rahmat!`);
      } else if (data.startsWith("ag:")) {
        // Admin moderation from a gig-review push. The LIVE allowlist is the security
        // boundary (also closes the stale-role window); approveGig/rejectGig re-check ADMIN.
        if (!isAdminTelegramId(cbFrom, process.env.ADMIN_TELEGRAM_IDS)) {
          void tgAnswerCallback(cb.id, "Faqat administrator uchun.");
        } else {
          const admin = { ...account, role: "ADMIN" as const };
          const [, act, gigId] = data.split(":");
          if (act === "a") {
            await approveGig(gigId ?? "", admin);
            void tgAnswerCallback(cb.id, "✅ Gig tasdiqlandi.");
          } else if (act === "r") {
            await rejectGig(gigId ?? "", admin);
            void tgAnswerCallback(cb.id, "❌ Gig rad etildi.");
          } else {
            void tgAnswerCallback(cb.id);
          }
        }
      } else {
        void tgAnswerCallback(cb.id);
      }
    } catch {
      void tgAnswerCallback(cb.id, "Amalni bajarib boʻlmadi.");
    }
    return NextResponse.json({ ok: true });
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
      // Routing failed AFTER we marked this update processed. Undo that mark and return a
      // non-2xx so Telegram redelivers — otherwise a transient DB blip silently drops the
      // user's reply. On redelivery the (now-removed) idempotency record lets it retry.
      if (typeof update.update_id === "number") {
        await prisma.processedUpdate
          .delete({ where: { updateId: BigInt(update.update_id) } })
          .catch(() => {});
      }
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  // Admin-only: /broadcast opens the broadcast composer (compose + audience + schedule)
  // in the Mini App — one tap, no clunky chat state machine.
  if (from && !from.is_bot && text === "/broadcast") {
    if (!isAdminTelegramId(from.id, process.env.ADMIN_TELEGRAM_IDS)) {
      void tgSendMessage(from.id, "Bu buyruq faqat administratorlar uchun.");
      return NextResponse.json({ ok: true });
    }
    const account = await prisma.user.findUnique({ where: { telegramId: String(from.id) }, select: { locale: true } });
    void tgSendMessage(from.id, "📣 Ommaviy xabar yuborish (darhol yoki rejalashtirilgan):", tgOpenButton(account?.locale, "/admin/broadcast"));
    return NextResponse.json({ ok: true });
  }

  // Admin-only: quick platform metrics (/stats) and action-queue counts (/pending) in chat.
  if (from && !from.is_bot && (text === "/stats" || text === "/pending")) {
    if (!isAdminTelegramId(from.id, process.env.ADMIN_TELEGRAM_IDS)) {
      void tgSendMessage(from.id, "Bu buyruq faqat administratorlar uchun.");
      return NextResponse.json({ ok: true });
    }
    const fmt = (n: number) => n.toLocaleString("ru-RU");
    if (text === "/stats") {
      const s = await getAdminStats();
      void tgSendMessage(
        from.id,
        `📊 Gigora — statistika\n\n` +
          `👥 Foydalanuvchilar: ${fmt(s.users)} (sotuvchi: ${fmt(s.sellers)})\n` +
          `📦 Aktiv xizmatlar: ${fmt(s.gigsActive)}\n` +
          `🧾 Buyurtmalar: ${fmt(s.totalOrders)}\n` +
          `💰 GMV: ${fmt(s.gmvUzs)} soʻm\n` +
          `🏦 Platforma daromadi: ${fmt(s.platformRevenueUzs)} soʻm` +
          (s.ledgerImbalanced > 0 ? `\n⚠️ Balanssiz buyurtmalar: ${fmt(s.ledgerImbalanced)}` : ``)
      );
    } else {
      const p = await getAdminPendingCounts();
      void tgSendMessage(
        from.id,
        `📋 Navbatdagi vazifalar (${fmt(p.gigs + p.kyc + p.disputes + p.payouts)})\n\n` +
          `🆕 Gig moderatsiyasi: ${fmt(p.gigs)}\n` +
          `🪪 KYC: ${fmt(p.kyc)}\n` +
          `⚠️ Nizolar: ${fmt(p.disputes)}\n` +
          `💸 Toʻlovlar: ${fmt(p.payouts)}`,
        tgOpenButton(undefined, "/admin")
      );
    }
    return NextResponse.json({ ok: true });
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
      const isAdmin = isAdminTelegramId(from.id, process.env.ADMIN_TELEGRAM_IDS);
      void tgSetChatMenuButton(from.id, locale);
      // Give admins the ops commands (/stats, /pending, /broadcast) in their "/" autocomplete.
      if (isAdmin) void tgSetChatCommands(from.id, ADMIN_BOT_COMMANDS);
      void tgSendMessage(
        from.id,
        tgWelcome(locale, name),
        tgMainKeyboard(locale, account?.isSeller ?? false, isAdmin)
      );
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
