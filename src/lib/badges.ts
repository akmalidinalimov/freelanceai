/**
 * Badge catalog — the controlled vocabulary of achievements. Stored per user as
 * UserBadge.key; labels are localized here. No `server-only`: imported by profile
 * and dashboard UI for rendering. Award logic lives in
 * src/server/services/gamification.ts (deterministic rules, nightly sweep + hooks).
 */

export type BadgeKind = "seller" | "buyer";

export interface BadgeDef {
  key: string;
  kind: BadgeKind;
  emoji: string;
  uz: string;
  ru: string;
  en: string;
}

export const BADGES: BadgeDef[] = [
  // ── Seller ────────────────────────────────────────────────────────────────
  { key: "seller_first_sale", kind: "seller", emoji: "🎉", uz: "Birinchi savdo", ru: "Первая продажа", en: "First sale" },
  { key: "seller_10_orders", kind: "seller", emoji: "🔟", uz: "10 buyurtma", ru: "10 заказов", en: "10 orders" },
  { key: "seller_50_orders", kind: "seller", emoji: "🏆", uz: "50 buyurtma", ru: "50 заказов", en: "50 orders" },
  { key: "seller_five_star_10", kind: "seller", emoji: "⭐", uz: "10 ta 5 yulduz", ru: "10 отзывов 5★", en: "10 five-star reviews" },
  { key: "seller_profile_complete", kind: "seller", emoji: "✅", uz: "Toʻliq profil", ru: "Полный профиль", en: "Complete profile" },
  { key: "seller_fast_responder", kind: "seller", emoji: "⚡", uz: "Tezkor javob", ru: "Быстрый ответ", en: "Fast responder" },
  // ── Buyer ─────────────────────────────────────────────────────────────────
  { key: "buyer_first_order", kind: "buyer", emoji: "🛍️", uz: "Birinchi buyurtma", ru: "Первый заказ", en: "First order" },
  { key: "buyer_5_orders", kind: "buyer", emoji: "💎", uz: "5 buyurtma", ru: "5 заказов", en: "5 orders" },
  { key: "buyer_10_reviews", kind: "buyer", emoji: "✍️", uz: "10 sharh", ru: "10 отзывов", en: "10 reviews" },
  { key: "streak_7", kind: "buyer", emoji: "🔥", uz: "7 kunlik seriya", ru: "Серия 7 дней", en: "7-day streak" },
  { key: "streak_30", kind: "buyer", emoji: "🚀", uz: "30 kunlik seriya", ru: "Серия 30 дней", en: "30-day streak" },
];

const BY_KEY = new Map(BADGES.map((b) => [b.key, b]));

export function badgeDef(key: string): BadgeDef | undefined {
  return BY_KEY.get(key);
}

export function badgeLabel(key: string, locale: string): string {
  const b = BY_KEY.get(key);
  if (!b) return key;
  return locale === "ru" ? b.ru : locale === "en" ? b.en : b.uz;
}

// XP levels — cosmetic tiers, label-only (no monetary meaning).
export const XP_LEVELS = [
  { min: 2000, key: "platinum", uz: "Platina", ru: "Платина", en: "Platinum" },
  { min: 750, key: "gold", uz: "Oltin", ru: "Золото", en: "Gold" },
  { min: 200, key: "silver", uz: "Kumush", ru: "Серебро", en: "Silver" },
  { min: 0, key: "bronze", uz: "Bronza", ru: "Бронза", en: "Bronze" },
] as const;

export function xpLevel(xp: number, locale: string): { key: string; label: string; nextAt: number | null } {
  const lvl = XP_LEVELS.find((l) => xp >= l.min) ?? XP_LEVELS[XP_LEVELS.length - 1];
  const idx = XP_LEVELS.indexOf(lvl);
  const next = idx > 0 ? XP_LEVELS[idx - 1].min : null;
  const label = locale === "ru" ? lvl.ru : locale === "en" ? lvl.en : lvl.uz;
  return { key: lvl.key, label, nextAt: next };
}
