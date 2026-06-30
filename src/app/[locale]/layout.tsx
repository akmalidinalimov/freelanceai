import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale, getTranslations, getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, isLocale } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "../globals.css";

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
  const skip =
    ({ uz: "Asosiy kontentga oʻtish", ru: "Перейти к содержимому", en: "Skip to content" } as Record<string, string>)[
      locale
    ] ?? "Skip to content";

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider messages={messages}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-[hsl(var(--primary))] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-[hsl(var(--primary-foreground))]"
          >
            {skip}
          </a>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
