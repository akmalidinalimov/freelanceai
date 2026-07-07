import type { Metadata } from "next";
import { Manrope, Unbounded } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale, getTranslations, getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, isLocale } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { ClarityAnalytics } from "@/components/clarity-analytics";
import { MetaPixel } from "@/components/meta-pixel";
import { CookieConsent } from "@/components/cookie-consent";
import { TelegramMiniAppBootstrap } from "@/components/telegram-miniapp-bootstrap";
import { UIProviders } from "@/components/ui-providers";
import { DotGridBackground } from "@/components/living-background/dot-grid";
import { BotReconnectBanner } from "@/components/bot-reconnect-banner";
import { ReferralCapture } from "@/components/referral-capture";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/session";
import { needsBotReconnect } from "@/lib/telegram-migration";
import "../globals.css";

// Manrope (body) + Unbounded (display). Both carry Cyrillic so RU headings render.
const manrope = Manrope({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
});
const unbounded = Unbounded({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["600", "700", "800"],
  variable: "--font-unbounded",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Brand" });
  return {
    title: `${t("name")} — ${t("tagline")}`,
    description: t("tagline"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  setRequestLocale(locale);
  // Pass ALL messages to the client so client components can use any namespace
  // (without this, next-intl only forwards namespaces accessed by server components
  // on the page — e.g. OrderPanel's "Order" namespace would be missing on the gig page).
  const messages = await getMessages();

  // Telegram bot migration: nudge users linked to the old bot to open the new one
  // (getCurrentUser is request-cached, so this reuses SiteHeader's load — no extra query).
  const user = await getCurrentUser();
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  const showReconnect = Boolean(user && botUsername && needsBotReconnect(user));

  const skip =
    ({ uz: "Asosiy kontentga oʻtish", ru: "Перейти к содержимому", en: "Skip to content" } as Record<string, string>)[
      locale
    ] ?? "Skip to content";

  return (
    <html lang={locale} className={`${manrope.variable} ${unbounded.variable} theme-d02`}>
      <body className="flex min-h-screen flex-col">
        {/* Dark world site-wide (founder direction 2026-07-07): the dot-grid ground is
            the default on every page. theme-d02 on <html> supplies the dark token
            palette + color-scheme so all token-based UI themes dark automatically.
            The homepage layers its own opaque D02Background (grid + beam) on top. */}
        <DotGridBackground />
        <NextIntlClientProvider messages={messages}>
          <UIProviders>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-[hsl(var(--primary))] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-[hsl(var(--primary-foreground))]"
          >
            {skip}
          </a>
          <SiteHeader />
          {showReconnect && botUsername && (
            <BotReconnectBanner deepLink={`https://t.me/${botUsername}`} botName={`@${botUsername}`} />
          )}
          <main id="main" className="flex-1 pb-16 md:pb-0">
            {children}
          </main>
          <SiteFooter />
          <MobileBottomNav />
          <CookieConsent />
          </UIProviders>
        </NextIntlClientProvider>
        <Suspense fallback={null}>
          <ReferralCapture />
        </Suspense>
        <TelegramMiniAppBootstrap />
        <ClarityAnalytics />
        <MetaPixel />
      </body>
    </html>
  );
}
