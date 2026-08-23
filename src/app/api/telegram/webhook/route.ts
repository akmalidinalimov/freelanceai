import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mintLaunchTicket } from "@/lib/launch-ticket";
import { upsertTelegramUser } from "@/lib/users";
import {
  tgSendMessage,
  tgMainKeyboard,
  tgSetChatMenuButton,
  miniAppUrl,
  tgOpenAppText,
  tgOpenAppLabel,
  tgWelcome,
  tgHelpText,
  tgOpenButton,
  tgAnswerCallback,
  tgSendLoginPrompt,
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
import { startBotOnboarding } from "@/server/services/bot-onboarding";

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
      // Names are carried so a login confirmation can seed onboarding for a brand-new user,
      // who has no account row yet at the moment they confirm.
      from?: { id: number; is_bot?: boolean; first_name?: string; last_name?: string };
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
    // Login confirmation runs BEFORE the account lookup: a first-time deep-link visitor has
    // no account yet, so the "sign in first" guard below would make signing in impossible.
    const cbData = cb.data ?? "";
    if (cbData.startsWith("lg:")) {
      const [, verdict, token] = cbData.split(":");
      if (verdict === "n") {
        await prisma.loginToken.deleteMany({ where: { token: token ?? "", telegramId: cbFrom } });
        void tgAnswerCallback(cb.id, "Bekor qilindi.");
        return NextResponse.json({ ok: true });
      }
      // Only the Telegram account that opened the deep link may confirm it, and only while it
      // is still PENDING and unexpired — all enforced in the WHERE so the claim is atomic.
      const confirmed = await prisma.loginToken.updateMany({
        where: { token: token ?? "", status: "PENDING", telegramId: cbFrom, expiresAt: { gt: new Date() } },
        data: { status: "CONFIRMED" },
      });
      if (confirmed.count === 0) {
        void tgAnswerCallback(cb.id, "Muddati tugagan. Saytda qayta urinib koʻring.");
        return NextResponse.json({ ok: true });
      }
      void tgAnswerCallback(cb.id, "✅ Tasdiqlandi!");
      void tgSendMessage(cb.from.id, "✅ Tasdiqlandi! Saytga qayting — avtomatik kirasiz.");
      const existing = await prisma.user.findUnique({
        where: { telegramId: cbFrom },
        select: { firstName: true, locale: true, onboardingCompleted: true },
      });
      if (!existing || !existing.onboardingCompleted) {
        void startBotOnboarding(
          cb.from.id,
          cb.from.first_name ?? "",
          cb.from.last_name ?? "",
          existing?.locale
        );
      }
      return NextResponse.json({ ok: true });
    }

    const account = await prisma.user.findFirst({ where: { telegramId: cbFrom, status: "ACTIVE" } });
    if (!account) {
      void tgAnswerCallback(cb.id, "Avval saytga kiring.");
      return NextResponse.json({ ok: true });
    }
    const data = cbData;
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

  // Admin-only: open the Mini App launch diagnostic. Two different faults render the SAME screen
  // (our chrome visible + a login prompt) — a missing marker, and empty initData — and they need
  // opposite fixes. Only Telegram's own client can tell them apart, so this is a one-tap probe.
  if (from && !from.is_bot && text === "/tgdebug") {
    if (!isAdminTelegramId(from.id, process.env.ADMIN_TELEGRAM_IDS)) {
      void tgSendMessage(from.id, "Bu buyruq faqat administratorlar uchun.");
      return NextResponse.json({ ok: true });
    }
    // `locale` is only resolved further down, after the account lookup — read it here directly.
    const acct = await prisma.user.findUnique({
      where: { telegramId: String(from.id) },
      select: { locale: true },
    });
    void tgSendMessage(from.id, "Diagnostika: tugmani bosing va ekranni yuboring.", {
      inline_keyboard: [
        [{ text: "🔍 Diagnostika", web_app: { url: miniAppUrl(acct?.locale, "/tg-debug") } }],
      ],
    });
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
      select: { firstName: true, locale: true, isSeller: true, onboardingCompleted: true },
    });
    // Captured BEFORE we create anything below. The onboarding branch further down keys off
    // whether an account already existed, and if it read a row we just created, a brand-new user's
    // very first /start would divert into the onboarding nudge and return early — skipping the
    // welcome, the keyboard, the menu button AND the zero-tap launch ticket, for exactly the
    // people that path exists to serve.
    const existedBefore = account !== null;
    const locale = account?.locale;
    const name = account?.firstName ?? from.first_name;

    // Remember them from the very first contact.
    //
    // Until now the account was created only when a sign-in actually completed, so someone who
    // tapped Start and did not immediately tap the button left NO record: their Telegram id lived
    // only in a launch ticket that expired in ten minutes. Telegram has already authenticated this
    // chat, so `from.id` is trustworthy identity — persist it and every later order, message and
    // profile attaches to the same row.
    if (!existedBefore && text.startsWith("/start")) {
      // Per-user cap so one account cannot churn rows by spamming /start. Same shape as the
      // existing tg-cb:/tg-reply: limiters in this file.
      if (rateLimit(`tg-newuser:${from.id}`, 5, 60_000)) {
        await upsertTelegramUser({
          id: String(from.id),
          firstName: from.first_name,
          lastName: from.last_name,
          username: from.username,
          authDate: Math.floor(Date.now() / 1000),
        }).catch((err) => {
          // A concurrent /start can lose the unique-index race. The row exists either way, which
          // is all we need, and the welcome below must not be blocked by it.
          console.error("upsert on /start failed", err);
        });
      }
    }

    // /start with a login-token payload: ASK, don't confirm.
    //
    // This used to flip the token to CONFIRMED on sight. Because the browser-nonce binding
    // ties the session to whoever called /start, a phisher could start a login in their own
    // browser, forward the t.me link, and have the victim's tap authenticate the ATTACKER's
    // session — the victim seeing only "✅ Tasdiqlandi". So we now claim the token for this
    // Telegram id (still PENDING) and require an explicit tap on a prompt showing a pairing
    // code the victim can only have seen on the login page they opened themselves.
    const payload = text.startsWith("/start") ? text.split(/\s+/)[1] : undefined;
    if (payload) {
      const claimed = await prisma.loginToken.updateMany({
        // `pairingCode: { not: null }` names the browser flow's own discriminator in the predicate
        // rather than leaving it implied. Launch tickets carry a null code and a null nonce, so
        // this makes it structurally impossible for one flow to claim the other's token.
        where: {
          token: payload,
          status: "PENDING",
          pairingCode: { not: null },
          expiresAt: { gt: new Date() },
          telegramId: null,
        },
        data: {
          telegramId: String(from.id),
          firstName: from.first_name,
          lastName: from.last_name,
          username: from.username,
        },
      });
      if (claimed.count > 0) {
        const lt = await prisma.loginToken.findUnique({
          where: { token: payload },
          select: { pairingCode: true, locale: true },
        });
        void tgSendLoginPrompt(from.id, payload, lt?.pairingCode ?? "??-??", lt?.locale ?? locale);
        return NextResponse.json({ ok: true });
      }
    }

    // Mint the ticket BEFORE any branch returns, so every reply to /start is a signed-in way in.
    // It used to be minted only in the welcome branch below, which the onboarding divert returns
    // ahead of — so every account with `onboardingCompleted: false` (i.e. every account created
    // before that default changed) got a button that opened the Mini App SIGNED OUT, and the
    // bot-hop fallback had nothing to hand back at all.
    const ticket =
      text.startsWith("/start") || text === "/menu"
        ? await mintLaunchTicket({
            telegramId: String(from.id),
            firstName: from.first_name,
            lastName: from.last_name,
            username: from.username,
            locale,
          }).catch((err) => {
            console.error("launch ticket failed", err);
            return null;
          })
        : null;

    // Unfinished profile → resume the conversation instead of the generic welcome.
    // `existedBefore` matters: without it the row we just created above would make this true on a
    // first /start and divert the new user into the onboarding nudge instead of the welcome.
    if (existedBefore && account && !account.onboardingCompleted && text !== "/help") {
      void startBotOnboarding(
        from.id,
        account.firstName ?? from.first_name ?? "",
        from.last_name ?? "",
        locale,
        ticket
      );
      return NextResponse.json({ ok: true });
    }

    if (text === "/help") {
      void tgSendMessage(from.id, tgHelpText(locale));
    } else {
      // Welcome + the always-visible role-aware keyboard + Menu Button → Mini App.
      const isAdmin = isAdminTelegramId(from.id, process.env.ADMIN_TELEGRAM_IDS);
      void tgSetChatMenuButton(from.id, locale);
      // Zero-tap sign-in: mint a single-use launch ticket into this chat so the very first tap
      // lands them INSIDE the app already signed in. Deliberately an inline button on this one
      // message, never the persistent keyboard or the menu button — those live for months, and a
      // long-lived ticket is a standing key. Once this establishes the session, the cookie carries
      // every later launch.
      if (ticket) {
        void tgSendMessage(from.id, tgOpenAppText(locale), {
          inline_keyboard: [
            [{ text: tgOpenAppLabel(locale), web_app: { url: miniAppUrl(locale, `/enter?tkt=${ticket}`) } }],
          ],
        });
      }
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
