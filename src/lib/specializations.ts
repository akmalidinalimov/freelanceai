/**
 * Specialization taxonomy — the controlled vocabulary of creator skills (what they make)
 * and niches (industries they serve). Source of truth is this constant (v1); it can
 * graduate to an admin-managed table later without changing the stored keys.
 *
 * Stored on `SellerProfile.specializations` as an array of `key`s (declared, optional).
 * Labels are localized (uz/ru/en). `synonyms` feed search query-expansion (uz/ru/en +
 * common misspellings) so the taxonomy itself makes discovery multilingual.
 *
 * No `server-only` — imported by the client profile form for the picker UI.
 */

export type SpecKind = "skill" | "niche";

export interface Spec {
  key: string;
  kind: SpecKind;
  uz: string;
  ru: string;
  en: string;
  synonyms: string[];
}

export const SPECIALIZATIONS: Spec[] = [
  // ── Skills — what they create ─────────────────────────────────────────────
  { key: "ai_video", kind: "skill", uz: "AI video", ru: "AI-видео", en: "AI video", synonyms: ["video", "rolik", "reels", "reel", "видео", "ролик"] },
  { key: "ai_image", kind: "skill", uz: "AI rasm / art", ru: "AI-изображения", en: "AI image / art", synonyms: ["rasm", "image", "art", "tasvir", "изображение", "картинка"] },
  { key: "ai_avatar", kind: "skill", uz: "AI avatar / talking-head", ru: "AI-аватар", en: "AI avatar / talking-head", synonyms: ["avatar", "talking head", "talking-head", "blogger", "аватар"] },
  { key: "product_photo", kind: "skill", uz: "Mahsulot fotosurati", ru: "Предметная съёмка", en: "Product photography", synonyms: ["foto", "fotosurat", "photo", "photography", "фото", "съёмка", "surat"] },
  { key: "voiceover", kind: "skill", uz: "Ovoz va dublyaj", ru: "Озвучка и дубляж", en: "Voiceover & dubbing", synonyms: ["ovoz", "voice", "voiceover", "dublyaj", "dubbing", "озвучка", "дубляж"] },
  { key: "branding", kind: "skill", uz: "Brending va logotip", ru: "Брендинг и логотип", en: "Branding & logo", synonyms: ["brend", "logo", "logotip", "identika", "brand", "бренд", "логотип"] },
  { key: "motion", kind: "skill", uz: "Motion / animatsiya", ru: "Моушн-графика", en: "Motion graphics", synonyms: ["motion", "animatsiya", "animation", "анимация", "моушн"] },
  { key: "image_edit", kind: "skill", uz: "Rasm tahrirlash / retush", ru: "Ретушь и обработка", en: "Image editing / retouch", synonyms: ["retush", "upscale", "tahrir", "edit", "retouch", "ретушь", "обработка"] },
  { key: "render_3d", kind: "skill", uz: "3D / render", ru: "3D-рендер", en: "3D & render", synonyms: ["3d", "render", "рендер"] },
  { key: "music_audio", kind: "skill", uz: "Musiqa va ovoz", ru: "Музыка и звук", en: "Music & sound", synonyms: ["musiqa", "music", "sound", "audio", "музыка", "звук"] },
  { key: "copywriting", kind: "skill", uz: "Kopiraiting / ssenariy", ru: "Копирайтинг", en: "Copywriting / scripts", synonyms: ["matn", "ssenariy", "script", "copy", "копирайтинг", "сценарий"] },
  { key: "presentation", kind: "skill", uz: "Taqdimot / pitch deck", ru: "Презентации", en: "Presentations", synonyms: ["taqdimot", "prezentatsiya", "pitch deck", "presentation", "презентация"] },

  // ── Niches — who they serve ───────────────────────────────────────────────
  { key: "fashion", kind: "niche", uz: "Moda va kiyim", ru: "Мода и одежда", en: "Fashion & apparel", synonyms: ["fashion", "moda", "kiyim", "lookbook", "clothing", "мода", "одежда"] },
  { key: "food_beverage", kind: "niche", uz: "Oziq-ovqat", ru: "Еда и напитки", en: "Food & beverage", synonyms: ["food", "oziq-ovqat", "restoran", "kafe", "cafe", "menyu", "еда", "ресторан"] },
  { key: "beauty", kind: "niche", uz: "Goʻzallik va kosmetika", ru: "Красота и косметика", en: "Beauty & cosmetics", synonyms: ["beauty", "kosmetika", "cosmetic", "красота", "косметика"] },
  { key: "ecommerce", kind: "niche", uz: "E-commerce / savdo", ru: "E-commerce", en: "E-commerce & retail", synonyms: ["ecommerce", "e-commerce", "magazin", "katalog", "retail", "магазин", "каталог"] },
  { key: "real_estate", kind: "niche", uz: "Koʻchmas mulk", ru: "Недвижимость", en: "Real estate", synonyms: ["real estate", "kochmas mulk", "kvartira", "недвижимость", "квартира"] },
  { key: "gaming", kind: "niche", uz: "Oʻyinlar", ru: "Игры", en: "Gaming", synonyms: ["gaming", "oyin", "game", "игры", "гейминг"] },
  { key: "entertainment", kind: "niche", uz: "Musiqa va shou", ru: "Музыка и шоу", en: "Music & entertainment", synonyms: ["entertainment", "shou", "konsert", "шоу", "концерт"] },
  { key: "education", kind: "niche", uz: "Taʼlim", ru: "Образование", en: "Education", synonyms: ["education", "talim", "kurs", "online kurs", "образование", "курс"] },
  { key: "corporate", kind: "niche", uz: "Korporativ / B2B", ru: "Корпоратив / B2B", en: "Corporate / B2B", synonyms: ["corporate", "b2b", "biznes", "корпоратив", "бизнес"] },
  { key: "health_fitness", kind: "niche", uz: "Sogʻliq va fitnes", ru: "Здоровье и фитнес", en: "Health & fitness", synonyms: ["fitness", "sogliq", "sport", "здоровье", "фитнес"] },
  { key: "travel", kind: "niche", uz: "Sayohat", ru: "Путешествия", en: "Travel & hospitality", synonyms: ["travel", "sayohat", "mehmonxona", "путешествия", "отель"] },
  { key: "automotive", kind: "niche", uz: "Avtomobil", ru: "Авто", en: "Automotive", synonyms: ["auto", "avtomobil", "mashina", "авто", "машина"] },
  { key: "tech_startup", kind: "niche", uz: "Texnologiya va startap", ru: "Технологии и стартапы", en: "Tech & startups", synonyms: ["tech", "startup", "it", "технологии", "стартап"] },
  { key: "events", kind: "niche", uz: "Tadbirlar va toʻylar", ru: "События и свадьбы", en: "Events & weddings", synonyms: ["toy", "tadbir", "event", "wedding", "свадьба", "мероприятие"] },
];

export const SKILLS: Spec[] = SPECIALIZATIONS.filter((s) => s.kind === "skill");
export const NICHES: Spec[] = SPECIALIZATIONS.filter((s) => s.kind === "niche");

const BY_KEY = new Map<string, Spec>(SPECIALIZATIONS.map((s) => [s.key, s]));
export const SPEC_KEYS: ReadonlySet<string> = new Set(BY_KEY.keys());

export function getSpec(key: string): Spec | undefined {
  return BY_KEY.get(key);
}

/** URL slug for a spec key (underscores → hyphens), e.g. "ai_video" → "ai-video". */
export function specSlug(key: string): string {
  return key.replace(/_/g, "-");
}

/** Resolve a URL slug back to its spec, e.g. "food-beverage" → the food_beverage Spec. */
export function specBySlug(slug: string): Spec | undefined {
  return BY_KEY.get(slug.replace(/-/g, "_"));
}

/** Localized label for a spec key; falls back to the key if unknown. */
export function specLabel(key: string, locale: string): string {
  const s = BY_KEY.get(key);
  if (!s) return key;
  return locale === "ru" ? s.ru : locale === "en" ? s.en : s.uz;
}

/** Keep only valid, unique keys, preserving order, capped. */
export function sanitizeSpecKeys(keys: string[], max = 30): string[] {
  const out: string[] = [];
  for (const k of keys) {
    if (SPEC_KEYS.has(k) && !out.includes(k)) out.push(k);
    if (out.length >= max) break;
  }
  return out;
}
