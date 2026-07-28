/**
 * Per-category service templates. A blank gig form asks a first-time seller to invent a
 * package ladder, sensible delivery times, the questions they should ask a buyer, and
 * upsells — decisions they have no basis for yet. A template answers all of it with
 * category-typical defaults they can then edit, which is faster AND produces better
 * gigs than a blank form plus willpower.
 *
 * Prices are UZS and sit at the low end of what these services actually go for locally
 * (2026): a seller who feels underpriced will raise it, one who feels overpriced quits.
 * Strings live here rather than in the message catalogs because they are content, not UI
 * chrome — they are edited as a set when the taxonomy changes.
 */

export type Loc = "uz" | "ru" | "en";

export interface GigTemplateTier {
  tier: "BASIC" | "STANDARD" | "PREMIUM";
  priceUzs: number;
  deliveryDays: number;
  revisions: number;
}

export interface GigTemplate {
  /** Category slug this template belongs to. */
  slug: string;
  /** Example title/description shown as placeholders — never auto-filled silently. */
  titleExample: Record<Loc, string>;
  descExample: Record<Loc, string>;
  /** Suggested tags (lowercase, matched against the search taxonomy). */
  tags: string[];
  /** A starting ladder; the form still only requires the first tier. */
  tiers: GigTemplateTier[];
  /** What the seller needs FROM the buyer before starting. */
  requirementPrompts: Record<Loc, string[]>;
  /** Typical upsells for this category. */
  extras: { label: Record<Loc, string>; priceUzs: number }[];
}

export const GIG_TEMPLATES: GigTemplate[] = [
  {
    slug: "ai-video",
    titleExample: {
      uz: "Brendingiz uchun 15 soniyalik AI reklama roligi",
      ru: "15-секундный AI-ролик для вашего бренда",
      en: "A 15-second AI ad video for your brand",
    },
    descExample: {
      uz: "Mahsulotingiz uchun qisqa, e'tibor tortadigan video tayyorlayman. Ssenariy, montaj, matn va musiqa — hammasi kiritilgan. Instagram Reels va TikTok formatlarida beraman.",
      ru: "Сделаю короткое цепляющее видео для вашего продукта. Сценарий, монтаж, текст и музыка включены. Отдам в форматах Reels и TikTok.",
      en: "A short, attention-holding video for your product. Script, edit, captions and music included. Delivered in Reels and TikTok formats.",
    },
    tags: ["ai video", "reels", "reklama"],
    tiers: [
      { tier: "BASIC", priceUzs: 150_000, deliveryDays: 3, revisions: 1 },
      { tier: "STANDARD", priceUzs: 300_000, deliveryDays: 3, revisions: 2 },
      { tier: "PREMIUM", priceUzs: 600_000, deliveryDays: 2, revisions: 3 },
    ],
    requirementPrompts: {
      uz: ["Mahsulot yoki xizmatingiz nima?", "Video qaysi platforma uchun (Reels, TikTok, YouTube)?", "Brend ranglari va logotipingiz bormi?"],
      ru: ["Что за продукт или услуга?", "Для какой платформы видео (Reels, TikTok, YouTube)?", "Есть ли фирменные цвета и логотип?"],
      en: ["What is the product or service?", "Which platform is the video for (Reels, TikTok, YouTube)?", "Do you have brand colours and a logo?"],
    },
    extras: [
      { label: { uz: "Tezroq yetkazish (24 soat)", ru: "Срочно (24 часа)", en: "Rush delivery (24h)" }, priceUzs: 100_000 },
      { label: { uz: "Vertikal + gorizontal versiya", ru: "Вертикальная + горизонтальная версия", en: "Vertical + horizontal cut" }, priceUzs: 60_000 },
      { label: { uz: "Ovoz ustidan o'qish", ru: "Озвучка", en: "Voiceover" }, priceUzs: 80_000 },
    ],
  },
  {
    slug: "ai-image",
    titleExample: {
      uz: "AI bilan brendingiz uchun 10 ta rasm",
      ru: "10 AI-изображений для вашего бренда",
      en: "10 AI images for your brand",
    },
    descExample: {
      uz: "Brendingiz uslubida yuqori sifatli rasmlar yarataman. Ijtimoiy tarmoq va reklama uchun tayyor formatda beraman.",
      ru: "Создам качественные изображения в стиле вашего бренда, готовые для соцсетей и рекламы.",
      en: "High-quality images in your brand's style, delivered ready for social and ads.",
    },
    tags: ["ai rasm", "art", "dizayn"],
    tiers: [
      { tier: "BASIC", priceUzs: 80_000, deliveryDays: 2, revisions: 1 },
      { tier: "STANDARD", priceUzs: 150_000, deliveryDays: 2, revisions: 2 },
      { tier: "PREMIUM", priceUzs: 300_000, deliveryDays: 3, revisions: 3 },
    ],
    requirementPrompts: {
      uz: ["Qanday rasm kerak — mahsulot, personaj, fon?", "Uslub namunasi bormi (havola yoki rasm)?", "Qanday o'lchamda kerak?"],
      ru: ["Какие изображения нужны — продукт, персонаж, фон?", "Есть пример стиля (ссылка или картинка)?", "Какой нужен размер?"],
      en: ["What kind of images — product, character, background?", "Any style reference (link or image)?", "What dimensions do you need?"],
    },
    extras: [
      { label: { uz: "Manba fayllar", ru: "Исходники", en: "Source files" }, priceUzs: 50_000 },
      { label: { uz: "Qo'shimcha 5 ta rasm", ru: "+5 изображений", en: "5 extra images" }, priceUzs: 60_000 },
      { label: { uz: "Tijorat huquqi", ru: "Коммерческие права", en: "Commercial licence" }, priceUzs: 100_000 },
    ],
  },
  {
    slug: "ai-avatar",
    titleExample: {
      uz: "O'zbek tilida gapiradigan AI avatar video",
      ru: "AI-аватар, говорящий на узбекском",
      en: "An AI talking-head avatar in Uzbek",
    },
    descExample: {
      uz: "Matningizni AI avatar orqali tabiiy ovoz bilan gapirtiraman. Ta'lim, reklama va e'lonlar uchun ideal.",
      ru: "Ваш текст озвучит AI-аватар естественным голосом. Идеально для обучения, рекламы и анонсов.",
      en: "Your script delivered by an AI avatar with a natural voice. Ideal for training, ads and announcements.",
    },
    tags: ["ai avatar", "talking head", "video"],
    tiers: [
      { tier: "BASIC", priceUzs: 120_000, deliveryDays: 2, revisions: 1 },
      { tier: "STANDARD", priceUzs: 250_000, deliveryDays: 2, revisions: 2 },
      { tier: "PREMIUM", priceUzs: 450_000, deliveryDays: 3, revisions: 3 },
    ],
    requirementPrompts: {
      uz: ["Matn tayyormi yoki yozib berishim kerakmi?", "Qaysi til — o'zbek, rus, ingliz?", "Erkak yoki ayol ovozi?"],
      ru: ["Текст готов или нужно написать?", "Какой язык — узбекский, русский, английский?", "Мужской или женский голос?"],
      en: ["Is the script ready, or should I write it?", "Which language — Uzbek, Russian, English?", "Male or female voice?"],
    },
    extras: [
      { label: { uz: "Ssenariy yozish", ru: "Написание сценария", en: "Script writing" }, priceUzs: 80_000 },
      { label: { uz: "Subtitrlar", ru: "Субтитры", en: "Subtitles" }, priceUzs: 40_000 },
    ],
  },
  {
    slug: "ai-ads",
    titleExample: {
      uz: "Instagram va Telegram uchun reklama kreativlari",
      ru: "Рекламные креативы для Instagram и Telegram",
      en: "Ad creatives for Instagram and Telegram",
    },
    descExample: {
      uz: "Sotuvni oshiradigan reklama kreativlari tayyorlayman — matn, vizual va chaqiruv (CTA) bilan. A/B test uchun bir nechta variant beraman.",
      ru: "Сделаю рекламные креативы, которые продают — текст, визуал и CTA. Несколько вариантов для A/B-теста.",
      en: "Ad creatives built to sell — copy, visual and a clear CTA. Several variants for A/B testing.",
    },
    tags: ["reklama", "kreativ", "ads"],
    tiers: [
      { tier: "BASIC", priceUzs: 100_000, deliveryDays: 2, revisions: 1 },
      { tier: "STANDARD", priceUzs: 220_000, deliveryDays: 2, revisions: 2 },
      { tier: "PREMIUM", priceUzs: 400_000, deliveryDays: 3, revisions: 3 },
    ],
    requirementPrompts: {
      uz: ["Nimani reklama qilamiz?", "Maqsadli auditoriya kim?", "Qaysi platformada joylashtirasiz?"],
      ru: ["Что рекламируем?", "Кто целевая аудитория?", "На какой платформе будет размещение?"],
      en: ["What are we advertising?", "Who is the target audience?", "Which platform will it run on?"],
    },
    extras: [
      { label: { uz: "Qo'shimcha 3 variant", ru: "+3 варианта", en: "3 extra variants" }, priceUzs: 70_000 },
      { label: { uz: "Reklama matni (copy)", ru: "Рекламный текст", en: "Ad copy" }, priceUzs: 50_000 },
    ],
  },
  {
    slug: "branding",
    titleExample: {
      uz: "Brendingiz uchun logotip va vizual uslub",
      ru: "Логотип и фирменный стиль для бренда",
      en: "A logo and visual identity for your brand",
    },
    descExample: {
      uz: "Biznesingiz uchun logotip va asosiy vizual uslubni tayyorlayman: ranglar, shriftlar va qo'llash namunalari. Manba fayllar bilan beraman.",
      ru: "Сделаю логотип и базовый фирменный стиль: цвета, шрифты и примеры применения. С исходниками.",
      en: "A logo plus the core identity: colours, type and usage examples. Source files included.",
    },
    tags: ["logotip", "brending", "identika"],
    tiers: [
      { tier: "BASIC", priceUzs: 200_000, deliveryDays: 3, revisions: 2 },
      { tier: "STANDARD", priceUzs: 450_000, deliveryDays: 4, revisions: 3 },
      { tier: "PREMIUM", priceUzs: 900_000, deliveryDays: 5, revisions: 4 },
    ],
    requirementPrompts: {
      uz: ["Biznes nomi va u nima qiladi?", "Yoqadigan uslub namunalari bormi?", "Qanday ranglardan qochish kerak?"],
      ru: ["Название бизнеса и чем он занимается?", "Есть примеры стиля, который нравится?", "Каких цветов избегать?"],
      en: ["Business name and what it does?", "Any style references you like?", "Colours to avoid?"],
    },
    extras: [
      { label: { uz: "Manba fayllar (AI/SVG)", ru: "Исходники (AI/SVG)", en: "Source files (AI/SVG)" }, priceUzs: 100_000 },
      { label: { uz: "Vizitka dizayni", ru: "Дизайн визитки", en: "Business card design" }, priceUzs: 80_000 },
      { label: { uz: "Ijtimoiy tarmoq shabloni", ru: "Шаблоны для соцсетей", en: "Social media templates" }, priceUzs: 120_000 },
    ],
  },
  {
    slug: "voiceover",
    titleExample: {
      uz: "O'zbek, rus va ingliz tilida professional ovoz",
      ru: "Профессиональная озвучка на узбекском, русском, английском",
      en: "Professional voiceover in Uzbek, Russian and English",
    },
    descExample: {
      uz: "Reklama, video va taqdimotlar uchun toza, tabiiy ovoz yozib beraman. Shovqinsiz studiya sifati.",
      ru: "Запишу чистый естественный голос для рекламы, видео и презентаций. Студийное качество без шума.",
      en: "Clean, natural voice recording for ads, video and presentations. Studio quality, no background noise.",
    },
    tags: ["ovoz", "dublyaj", "voiceover"],
    tiers: [
      { tier: "BASIC", priceUzs: 60_000, deliveryDays: 1, revisions: 1 },
      { tier: "STANDARD", priceUzs: 120_000, deliveryDays: 2, revisions: 2 },
      { tier: "PREMIUM", priceUzs: 250_000, deliveryDays: 2, revisions: 3 },
    ],
    requirementPrompts: {
      uz: ["Matnni yuboring (yoki so'z sonini yozing)", "Qaysi til va urg'u kerak?", "Qanday ohang — rasmiy, do'stona, energiyali?"],
      ru: ["Пришлите текст (или количество слов)", "Какой язык и акцент нужен?", "Какой тон — official, дружеский, энергичный?"],
      en: ["Send the script (or the word count)", "Which language and accent?", "What tone — formal, friendly, energetic?"],
    },
    extras: [
      { label: { uz: "Fon musiqasi bilan miks", ru: "Микс с фоновой музыкой", en: "Mix with background music" }, priceUzs: 50_000 },
      { label: { uz: "Tezroq yetkazish (12 soat)", ru: "Срочно (12 часов)", en: "Rush delivery (12h)" }, priceUzs: 60_000 },
    ],
  },
];

export const templateForSlug = (slug?: string | null): GigTemplate | undefined =>
  GIG_TEMPLATES.find((t) => t.slug === slug);
