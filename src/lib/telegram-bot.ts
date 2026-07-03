import "server-only";

/**
 * Thin client for the Telegram Bot API. Server-only (uses the bot token).
 * Used by the bot deep-link login flow (webhook + sendMessage) and webhook setup.
 */

function api(method: string): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return `https://api.telegram.org/bot${token}/${method}`;
}

export async function tgSendMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: Record<string, unknown>
): Promise<boolean> {
  try {
    const res = await fetch(api("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }),
    });
    // Telegram answers 200 {ok:true} on accept; 403 = user blocked the bot — the
    // caller must know delivery failed (digest falls back to email on this).
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null));
    return body?.ok === true;
  } catch (err) {
    console.error("tgSendMessage failed", err);
    return false;
  }
}

/** Prompt the user to share their (Telegram-verified) phone via a one-tap contact button. */
export async function tgRequestContact(chatId: number | string, prompt: string): Promise<void> {
  await tgSendMessage(chatId, prompt, {
    keyboard: [[{ text: "📱 Telefon raqamni ulashish", request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  });
}

function appOrigin(): string {
  return (process.env.APP_ORIGIN ?? "https://gigora.ai").replace(/\/$/, "");
}

type Loc = "uz" | "ru" | "en";
const asLoc = (l?: string): Loc => (l === "ru" || l === "en" ? l : "uz");

/**
 * The always-visible, role-aware app nav (persistent reply keyboard). Each button
 * is a `web_app` button that opens the actual platform screen as a Mini App —
 * passwordless via initData (see telegram-miniapp-bootstrap). This is the founder's
 * "buttons on the keyboard that are always visible", not inline buttons.
 */
export function tgMainKeyboard(locale: string | undefined, isSeller: boolean): Record<string, unknown> {
  const loc = asLoc(locale);
  const origin = appOrigin();
  const wa = (path: string) => ({ url: `${origin}/${loc}${path}` });
  const L = KEYBOARD_LABELS[loc];

  const rows = isSeller
    ? [
        [{ text: L.dashboard, web_app: wa("/dashboard/seller") }, { text: L.messages, web_app: wa("/messages") }],
        [{ text: L.gigs, web_app: wa("/dashboard/seller") }, { text: L.newGig, web_app: wa("/dashboard/seller/gigs/new") }],
        [{ text: L.profile, web_app: wa("/dashboard/seller/profile") }, { text: L.help }],
      ]
    : [
        [{ text: L.search, web_app: wa("/search") }, { text: L.messages, web_app: wa("/messages") }],
        [{ text: L.orders, web_app: wa("/dashboard") }, { text: L.saved, web_app: wa("/dashboard/saved") }],
        [{ text: L.profile, web_app: wa("/dashboard/settings") }, { text: L.help }],
      ];

  return { keyboard: rows, is_persistent: true, resize_keyboard: true };
}

/** Set the chat Menu Button (beside the input) to launch the Mini App home. */
export async function tgSetChatMenuButton(chatId: number | string, locale?: string): Promise<void> {
  const loc = asLoc(locale);
  try {
    await fetch(api("setChatMenuButton"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        menu_button: {
          type: "web_app",
          text: KEYBOARD_LABELS[loc].openApp,
          web_app: { url: `${appOrigin()}/${loc}` },
        },
      }),
    });
  } catch (err) {
    console.error("tgSetChatMenuButton failed", err);
  }
}

const KEYBOARD_LABELS: Record<Loc, Record<string, string>> = {
  uz: {
    search: "🔍 Qidirish", messages: "📨 Xabarlar", orders: "🛒 Buyurtmalarim",
    saved: "❤️ Saqlangan", profile: "👤 Profil", help: "ℹ️ Yordam",
    dashboard: "📊 Boshqaruv", gigs: "📦 Gaglarim", newGig: "➕ Yangi gig",
    openApp: "🚀 Gigora'ni ochish",
  },
  ru: {
    search: "🔍 Поиск", messages: "📨 Сообщения", orders: "🛒 Мои заказы",
    saved: "❤️ Избранное", profile: "👤 Профиль", help: "ℹ️ Помощь",
    dashboard: "📊 Панель", gigs: "📦 Мои услуги", newGig: "➕ Новая услуга",
    openApp: "🚀 Открыть Gigora",
  },
  en: {
    search: "🔍 Search", messages: "📨 Messages", orders: "🛒 My orders",
    saved: "❤️ Saved", profile: "👤 Profile", help: "ℹ️ Help",
    dashboard: "📊 Dashboard", gigs: "📦 My gigs", newGig: "➕ New gig",
    openApp: "🚀 Open Gigora",
  },
};

export const HELP_LABELS: Record<Loc, string> = {
  uz: "ℹ️ Yordam", ru: "ℹ️ Помощь", en: "ℹ️ Help",
};

const OPEN_LABEL: Record<Loc, string> = { uz: "Ochish", ru: "Открыть", en: "Open" };

/** Full Mini App URL for a platform path (used in notification "open" buttons). */
export function miniAppUrl(locale: string | undefined, path: string): string {
  return `${appOrigin()}/${asLoc(locale)}${path}`;
}

/** Inline "open in the app" button (opens the Mini App at `path`). */
export function tgOpenButton(locale: string | undefined, path: string): Record<string, unknown> {
  return {
    inline_keyboard: [[{ text: OPEN_LABEL[asLoc(locale)], web_app: { url: miniAppUrl(locale, path) } }]],
  };
}

export function tgWelcome(locale: string | undefined, name?: string): string {
  const loc = asLoc(locale);
  const who = name ? `, ${name}` : "";
  return {
    uz: `Salom${who}! 👋 Gigora'ga xush kelibsiz. Quyidagi tugmalar orqali hamma narsani shu yerda — Telegram ichida — parolsiz bajaring.`,
    ru: `Привет${who}! 👋 Добро пожаловать в Gigora. Кнопки ниже открывают всё прямо здесь, в Telegram — без пароля.`,
    en: `Hi${who}! 👋 Welcome to Gigora. The buttons below open everything right here in Telegram — no password.`,
  }[loc];
}

export function tgHelpText(locale: string | undefined): string {
  const loc = asLoc(locale);
  return {
    uz: "Tugmalardan foydalaning: Qidirish, Xabarlar, Buyurtmalar, Profil. Har biri ilovani shu yerda ochadi. Savol boʻlsa — @gigora_support.",
    ru: "Используйте кнопки: Поиск, Сообщения, Заказы, Профиль. Каждая открывает приложение здесь. Вопросы — @gigora_support.",
    en: "Use the buttons: Search, Messages, Orders, Profile. Each opens the app right here. Questions — @gigora_support.",
  }[loc];
}

/** Register the webhook (called once during setup). */
export async function tgSetWebhook(url: string, secretToken: string): Promise<unknown> {
  const res = await fetch(api("setWebhook"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secretToken,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    }),
  });
  return res.json();
}
