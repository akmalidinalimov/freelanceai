import { defineRouting } from "next-intl/routing";

export const locales = ["uz", "ru", "en"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  // Uzbek is the launch locale; RU/EN follow (Phase 10).
  defaultLocale: "uz",
  // Always show the locale prefix (/uz, /ru, /en) for clear, SEO-friendly URLs.
  localePrefix: "always",
});

/** Type guard: is the given value one of our supported locales? */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
