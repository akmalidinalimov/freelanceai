import "server-only";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { tgSendMessage, tgOpenButton, tgFileUrl, miniAppUrl } from "@/lib/telegram-bot";
import { uploadFromUrl } from "@/lib/media";
import { addPortfolioItem } from "@/server/services/profile";
import { audit } from "@/lib/audit";

/**
 * Bot-native onboarding: the profile-filling conversation runs INSIDE Telegram —
 * name confirm → buy/sell intent → (sellers) AI experience → portfolio photos sent
 * straight to the chat. Every answer persists to the same User/SellerProfile fields
 * the web flow writes, so the two paths can never disagree. Buttons carry their own
 * state in callback_data ("ob:*"); only the two free-input steps (typed name, photo
 * drops) use User.botOnboardStep.
 */

type Loc = "uz" | "ru" | "en";
const asLoc = (l?: string | null): Loc => (l === "ru" || l === "en" ? l : "uz");

const T = {
  // Primary welcome: one tap opens the profile form in the Mini App, where fields and
  // the photo upload (with cropping) live. The chat Q&A stays as a second button for
  // anyone who would rather answer here.
  kickoff: {
    uz: (f: string) =>
      `🎉 Xush kelibsiz${f ? ", " + f : ""}!\n\nProfilingizni toʻldirib olamiz — ism, nima ish qilasiz va profil rasmi. Bir daqiqa vaqt oladi ✨\n\nPastdagi tugmani bosing 👇`,
    ru: (f: string) =>
      `🎉 Добро пожаловать${f ? ", " + f : ""}!\n\nЗаполним профиль — имя, чем вы занимаетесь и фото профиля. Это займёт минуту ✨\n\nНажмите кнопку ниже 👇`,
    en: (f: string) =>
      `🎉 Welcome${f ? ", " + f : ""}!\n\nLet's fill in your profile — your name, what you do, and a profile photo. Takes a minute ✨\n\nTap the button below 👇`,
  },
  openForm: {
    uz: "✍️ Profilni toʻldirish",
    ru: "✍️ Заполнить профиль",
    en: "✍️ Fill in my profile",
  },
  chatInstead: {
    uz: "💬 Shu yerda javob beraman",
    ru: "💬 Ответить здесь",
    en: "💬 Answer here instead",
  },
  chatIntro: {
    uz: (f: string, l: string) => `Yaxshi! 😉\n\n👤 Siz: ${f}${l ? " " + l : ""}\nToʻgʻrimi?`,
    ru: (f: string, l: string) => `Хорошо! 😉\n\n👤 Вы: ${f}${l ? " " + l : ""}\nВерно?`,
    en: (f: string, l: string) => `Sure! 😉\n\n👤 You: ${f}${l ? " " + l : ""}\nIs that right?`,
  },
  nameOk: { uz: "✅ Toʻgʻri", ru: "✅ Верно", en: "✅ That's me" },
  nameEdit: { uz: "✏️ Boshqacha", ru: "✏️ Изменить", en: "✏️ Edit" },
  namePrompt: {
    uz: "✏️ Ism va familiyangizni yozib yuboring (masalan: Aziza Karimova)",
    ru: "✏️ Напишите имя и фамилию (например: Азиза Каримова)",
    en: "✏️ Type your first and last name (e.g., Aziza Karimova)",
  },
  role: {
    uz: (f: string) => `Rahmat, ${f}! 👍\nGigora'da nima qilasiz?`,
    ru: (f: string) => `Спасибо, ${f}! 👍\nЧто будете делать на Gigora?`,
    en: (f: string) => `Thanks, ${f}! 👍\nWhat brings you to Gigora?`,
  },
  roleBuy: { uz: "🛍 Xizmat sotib olaman", ru: "🛍 Заказывать услуги", en: "🛍 Hire creators" },
  roleSell: { uz: "🎨 Ijodkorman — ish sotaman", ru: "🎨 Я креатор — продаю работу", en: "🎨 I'm a creator — selling" },
  buyDone: {
    uz: "Zoʻr tanlov! 🛍 Ustalar tayyor — xizmatlarni koʻring va bir jumla bilan buyurtma bering:",
    ru: "Отличный выбор! 🛍 Креаторы готовы — смотрите услуги и заказывайте:",
    en: "Great choice! 🛍 The creators are ready — browse and order:",
  },
  exp: {
    uz: "🔥 Ijodkor! AI bilan qanchadan beri ishlaysiz?",
    ru: "🔥 Креатор! Сколько вы уже работаете с AI?",
    en: "🔥 A creator! How long have you been working with AI?",
  },
  exp0: { uz: "🌱 1 yildan kam", ru: "🌱 Менее 1 года", en: "🌱 Under 1 year" },
  exp1: { uz: "⚡ 1–2 yil", ru: "⚡ 1–2 года", en: "⚡ 1–2 years" },
  exp3: { uz: "🚀 3–5 yil", ru: "🚀 3–5 лет", en: "🚀 3–5 years" },
  exp5: { uz: "🏆 5+ yil", ru: "🏆 5+ лет", en: "🏆 5+ years" },
  portfolio: {
    uz: "Deyarli tayyor! 📸 Eng zoʻr 2–4 ishingizni SHU YERGA rasm qilib tashlang — profilingizga qoʻshamiz.\nYoki keyinroq ham boʻladi 👇",
    ru: "Почти готово! 📸 Пришлите СЮДА 2–4 лучшие работы фото — добавим в профиль.\nИли можно позже 👇",
    en: "Almost done! 📸 Drop 2–4 of your best works right HERE as photos — we'll add them to your profile.\nOr do it later 👇",
  },
  skip: { uz: "⏭ Keyinroq", ru: "⏭ Позже", en: "⏭ Later" },
  photoSaved: {
    uz: (n: number) => `🖼 Qoʻshildi (${n})! Yana tashlang yoki tugating:`,
    ru: (n: number) => `🖼 Добавлено (${n})! Ещё — или завершаем:`,
    en: (n: number) => `🖼 Added (${n})! Send more or finish:`,
  },
  photoFail: {
    uz: "Rasmni saqlab boʻlmadi 😔 Keyinroq saytdagi profilingizdan qoʻshishingiz mumkin.",
    ru: "Не удалось сохранить фото 😔 Можно добавить позже в профиле на сайте.",
    en: "Couldn't save that photo 😔 You can add it later from your profile on the site.",
  },
  done: { uz: "✅ Tayyor", ru: "✅ Готово", en: "✅ Done" },
  sellerDone: {
    uz: (f: string) =>
      `🎉 Profil tayyor, ${f}!\nEndi birinchi e'loningizni yarataylik — siz BITTA jumla yozasiz, qolganini AI qiladi ✨`,
    ru: (f: string) =>
      `🎉 Профиль готов, ${f}!\nТеперь создадим первое объявление — вы пишете ОДНО предложение, остальное сделает AI ✨`,
    en: (f: string) =>
      `🎉 Profile ready, ${f}!\nNow let's create your first gig — you write ONE sentence, AI does the rest ✨`,
  },
} as const;

const kb = (rows: { text: string; data: string }[][]) => ({
  inline_keyboard: rows.map((r) => r.map((b) => ({ text: b.text, callback_data: b.data }))),
});

/**
 * Kick off onboarding (after login confirm, or /start with an unfinished profile).
 * Leads with a Mini App button into the profile form — that's where the fields and
 * the photo upload (with cropping) actually live. A second button keeps the
 * answer-in-chat path for anyone who prefers it.
 */
export async function startBotOnboarding(
  tgId: number | string,
  firstName: string,
  lastName: string,
  locale?: string | null
): Promise<void> {
  const L = asLoc(locale);
  await tgSendMessage(tgId, T.kickoff[L](firstName || ""), {
    inline_keyboard: [
      [{ text: T.openForm[L], web_app: { url: miniAppUrl(locale ?? undefined, "/onboarding") } }],
      [{ text: T.chatInstead[L], callback_data: "ob:chat" }],
    ],
  });
}

const askRole = (tgId: number | string, L: Loc, firstName: string) =>
  tgSendMessage(tgId, T.role[L](firstName), kb([
    [{ text: T.roleBuy[L], data: "ob:r:buy" }],
    [{ text: T.roleSell[L], data: "ob:r:sell" }],
  ]));

const askExp = (tgId: number | string, L: Loc) =>
  tgSendMessage(tgId, T.exp[L], kb([
    [{ text: T.exp0[L], data: "ob:e:0" }, { text: T.exp1[L], data: "ob:e:1" }],
    [{ text: T.exp3[L], data: "ob:e:3" }, { text: T.exp5[L], data: "ob:e:5" }],
  ]));

const askPortfolio = (tgId: number | string, L: Loc) =>
  tgSendMessage(tgId, T.portfolio[L], kb([[{ text: T.skip[L], data: "ob:p:skip" }]]));

async function finishSeller(account: User, L: Loc) {
  await prisma.user.update({ where: { id: account.id }, data: { botOnboardStep: null } });
  await tgSendMessage(
    String(account.telegramId),
    T.sellerDone[L](account.firstName ?? ""),
    tgOpenButton(account.locale, "/dashboard/seller/gigs/new")
  );
}

/** Handle an ob:* button tap. Returns the toast text for answerCallbackQuery. */
export async function handleOnboardCallback(account: User, data: string): Promise<string | undefined> {
  const L = asLoc(account.locale);
  const tgId = String(account.telegramId);

  if (data === "ob:chat") {
    // They chose to answer in the chat — start with the name confirmation.
    await tgSendMessage(
      tgId,
      T.chatIntro[L](account.firstName ?? "—", account.lastName ?? ""),
      kb([[{ text: T.nameOk[L], data: "ob:n:ok" }, { text: T.nameEdit[L], data: "ob:n:edit" }]])
    );
    return undefined;
  }
  if (data === "ob:n:ok") {
    await askRole(tgId, L, account.firstName ?? "");
    return undefined;
  }
  if (data === "ob:n:edit") {
    await prisma.user.update({ where: { id: account.id }, data: { botOnboardStep: "name" } });
    await tgSendMessage(tgId, T.namePrompt[L]);
    return undefined;
  }
  if (data === "ob:r:buy") {
    await prisma.user.update({
      where: { id: account.id },
      data: { onboardingCompleted: true, botOnboardStep: null },
    });
    await audit({ actorId: account.id, action: "onboarding.buyer", entity: "User", entityId: account.id });
    await tgSendMessage(tgId, T.buyDone[L], tgOpenButton(account.locale, "/gigs"));
    return "🛍";
  }
  if (data === "ob:r:sell") {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: account.id },
        data: { isSeller: true, onboardingCompleted: true },
      }),
      prisma.sellerProfile.upsert({ where: { userId: account.id }, update: {}, create: { userId: account.id } }),
    ]);
    await audit({ actorId: account.id, action: "onboarding.become_seller", entity: "User", entityId: account.id });
    await askExp(tgId, L);
    return "🎨";
  }
  if (data.startsWith("ob:e:")) {
    const years = Math.max(0, Math.min(50, parseInt(data.slice(5), 10) || 0));
    await prisma.sellerProfile.upsert({
      where: { userId: account.id },
      update: { experienceYears: years },
      create: { userId: account.id, experienceYears: years },
    });
    // Portfolio photos arrive as plain messages — remember we're waiting for them.
    await prisma.user.update({ where: { id: account.id }, data: { botOnboardStep: "portfolio" } });
    await askPortfolio(tgId, L);
    return "🚀";
  }
  if (data === "ob:p:skip") {
    await finishSeller(account, L);
    return undefined;
  }
  return undefined;
}

/** Typed answer for the "name" step. Returns true when the text was consumed. */
export async function handleOnboardText(account: User, text: string): Promise<boolean> {
  if (account.botOnboardStep !== "name") return false;
  const words = text.trim().split(/\s+/).slice(0, 5);
  const firstName = (words[0] ?? "").slice(0, 60);
  const lastName = words.slice(1).join(" ").slice(0, 60) || null;
  if (!firstName) return false;
  await prisma.user.update({
    where: { id: account.id },
    data: { firstName, lastName, botOnboardStep: null },
  });
  await askRole(String(account.telegramId), asLoc(account.locale), firstName);
  return true;
}

/** Cap on photos accepted through the bot conversation. */
const BOT_PORTFOLIO_MAX = 8;

/** Photo dropped during the "portfolio" step: pull it from Telegram into R2 and attach. */
export async function handleOnboardPhoto(account: User, fileId: string): Promise<boolean> {
  if (account.botOnboardStep !== "portfolio") return false;
  const L = asLoc(account.locale);
  const tgId = String(account.telegramId);

  const count = await prisma.portfolioItem.count({ where: { profile: { userId: account.id } } });
  if (count >= BOT_PORTFOLIO_MAX) {
    await finishSeller(account, L);
    return true;
  }
  const src = await tgFileUrl(fileId);
  let saved = false;
  if (src) {
    try {
      const publicUrl = await uploadFromUrl(`portfolio/${account.id}`, src);
      await addPortfolioItem(account.id, publicUrl, "image");
      saved = true;
    } catch {
      /* storage unavailable — fall through to the friendly failure message */
    }
  }
  if (saved) {
    await tgSendMessage(tgId, T.photoSaved[L](count + 1), kb([[{ text: T.done[L], data: "ob:p:skip" }]]));
  } else {
    await tgSendMessage(tgId, T.photoFail[L], tgOpenButton(account.locale, "/dashboard/seller/portfolio"));
  }
  return true;
}
