import "server-only";
import { prisma } from "@/lib/prisma";
import { tgSendMessage, miniAppUrl } from "@/lib/telegram-bot";

/**
 * Telegram-side onboarding: TWO nudges, each a single Mini App button. The forms
 * themselves live on the platform (that's where photo upload + cropping, skill tags
 * and the gig wizard are) — the bot's job is to get the user there at the right
 * moment, not to re-implement a form in chat.
 *
 *   1. New account            → "✍️ Profil registratsiyasi"  → /onboarding
 *   2. Profile now complete   → "🚀 Xizmat yaratish"         → the gig wizard
 *
 * Nudge 2 fires once per user (idempotent via an ActivityEvent) the first time their
 * profile has everything a storefront needs.
 */

type Loc = "uz" | "ru" | "en";
const asLoc = (l?: string | null): Loc => (l === "ru" || l === "en" ? l : "uz");

const T = {
  kickoff: {
    uz: (f: string) =>
      `🎉 Xush kelibsiz${f ? ", " + f : ""}!\n\nProfilingizni toʻldirib olamiz — ism, profil rasmi, nima ish qilasiz va koʻnikmalaringiz. Bir daqiqa vaqt oladi ✨\n\nPastdagi tugmani bosing 👇`,
    ru: (f: string) =>
      `🎉 Добро пожаловать${f ? ", " + f : ""}!\n\nЗаполним профиль — имя, фото, чем вы занимаетесь и навыки. Это займёт минуту ✨\n\nНажмите кнопку ниже 👇`,
    en: (f: string) =>
      `🎉 Welcome${f ? ", " + f : ""}!\n\nLet's fill in your profile — name, photo, what you do and your skills. Takes a minute ✨\n\nTap the button below 👇`,
  },
  openForm: {
    uz: "✍️ Profil registratsiyasi",
    ru: "✍️ Регистрация профиля",
    en: "✍️ Register my profile",
  },
  serviceReady: {
    uz: (f: string) =>
      `✅ Profilingiz tayyor${f ? ", " + f : ""}!\n\nEndi birinchi xizmatingizni yarataylikmi? Siz bir jumla yozasiz — AI sarlavha, tavsif va paketlarni tayyorlab beradi ✨\n\n📌 Eslatma: xizmat yaratilgandan keyin tekshiruvga yuboriladi. Tasdiqlangach xaridorlar koʻra boshlaydi.`,
    ru: (f: string) =>
      `✅ Профиль готов${f ? ", " + f : ""}!\n\nСоздадим первую услугу? Вы пишете одно предложение — AI подготовит заголовок, описание и пакеты ✨\n\n📌 Важно: после создания услуга уходит на проверку. Покупатели увидят её после одобрения.`,
    en: (f: string) =>
      `✅ Your profile is ready${f ? ", " + f : ""}!\n\nShall we create your first service? You write one sentence — AI drafts the title, description and packages ✨\n\n📌 Note: once created it goes to review. Buyers see it after approval.`,
  },
  createService: {
    uz: "🚀 Xizmat yaratish",
    ru: "🚀 Создать услугу",
    en: "🚀 Create a service",
  },
} as const;

/** Nudge 1 — new account (after login confirm, or /start with an unfinished profile). */
export async function startBotOnboarding(
  tgId: number | string,
  firstName: string,
  _lastName: string,
  locale?: string | null,
  /**
   * A single-use launch ticket, so the Mini App this button opens arrives SIGNED IN.
   *
   * Without one this message was a dead end: it is the branch every account with
   * `onboardingCompleted: false` takes on /start — which is every account created before that
   * default changed — and the form it opens is behind an auth guard, so the user landed on a login
   * screen having just tapped a button in an authenticated chat.
   */
  ticket?: string | null
): Promise<void> {
  const L = asLoc(locale);
  const path = ticket
    ? `/enter?tkt=${ticket}&next=${encodeURIComponent(`/${asLoc(locale)}/onboarding`)}`
    : "/onboarding";
  await tgSendMessage(tgId, T.kickoff[L](firstName || ""), {
    inline_keyboard: [
      [{ text: T.openForm[L], web_app: { url: miniAppUrl(locale ?? undefined, path) } }],
    ],
  });
}

/**
 * Nudge 2 — the profile just became storefront-ready: invite them into the gig wizard,
 * and set the expectation up front that a new service goes to review before buyers see
 * it. One-shot per user; never throws (a missed nudge must not break a profile save).
 */
export async function nudgeCreateService(userId: string): Promise<void> {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        telegramId: true,
        firstName: true,
        locale: true,
        isSeller: true,
        telegramBlockedAt: true,
        notifyTelegram: true,
        sellerProfile: { select: { headline: true, bio: true, specializations: true } },
        _count: { select: { gigs: true } },
      },
    });
    if (!u?.telegramId || !u.isSeller || u.telegramBlockedAt || !u.notifyTelegram) return;
    if (u._count.gigs > 0) return; // they already have a service — nothing to invite
    const p = u.sellerProfile;
    const ready = Boolean(p?.headline?.trim() && p?.bio?.trim() && (p?.specializations.length ?? 0) > 0);
    if (!ready) return;

    // Idempotent: one invite per user, ever.
    const already = await prisma.activityEvent.findFirst({
      where: { type: "bot_service_nudge", entityId: userId },
      select: { id: true },
    });
    if (already) return;

    const L = asLoc(u.locale);
    const sent = await tgSendMessage(u.telegramId, T.serviceReady[L](u.firstName ?? ""), {
      inline_keyboard: [
        [
          {
            text: T.createService[L],
            web_app: { url: miniAppUrl(u.locale, "/dashboard/seller/gigs/new") },
          },
        ],
      ],
    });
    if (sent) {
      await prisma.activityEvent
        .create({ data: { userId, type: "bot_service_nudge", entityId: userId } })
        .catch(() => {});
    }
  } catch {
    // best-effort by design
  }
}
