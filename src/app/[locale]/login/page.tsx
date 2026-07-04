import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { redirect as nextRedirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { safeInternalPath } from "@/lib/utils";
import { TelegramDeepLinkLogin } from "@/components/telegram-deeplink-login";
import { GoogleLoginButton } from "@/components/google-login-button";
import { EmailLoginForm } from "@/components/email-login-form";
import { emailConfigured } from "@/lib/email";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { error, next: rawNext } = await searchParams;
  // Login-return path (e.g. a guest clicked "Buyurtma berish" on a gig).
  // Validated to same-origin relative paths; anything else falls back to home.
  const next = safeInternalPath(rawNext ?? null);

  // Already signed in → continue where the visitor was headed.
  const user = await getCurrentUser();
  if (user) {
    // `next` is a full locale-prefixed path (e.g. /uz/gigs/x) → use plain
    // next/navigation redirect so next-intl doesn't prepend the locale AGAIN
    // (which would 404 as /uz/uz/...). Locale-less fallback uses the i18n redirect.
    if (next) nextRedirect(next);
    redirect({ href: "/", locale });
  }

  const t = await getTranslations("Nav");
  const tb = await getTranslations("Brand");
  const ta = await getTranslations("Auth");

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <div>
        <h1 className="text-3xl font-bold">{t("login")}</h1>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">
          {tb("name")} — {tb("tagline")}
        </p>
      </div>

      {next && (
        <p className="w-full rounded-md border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/8 px-4 py-2 text-sm text-[hsl(var(--primary-ink))]">
          {ta("loginToContinue")}
        </p>
      )}

      {error === "auth" && (
        <p className="w-full rounded-md border border-[hsl(var(--danger))]/40 bg-[hsl(var(--danger-soft))] px-4 py-2 text-sm text-[hsl(var(--danger))]">
          Authentication failed. Please try again.
        </p>
      )}

      <TelegramDeepLinkLogin locale={locale} />

      <div className="flex w-full items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
        <span className="h-px flex-1 bg-[hsl(var(--border))]" />
        {ta("or")}
        <span className="h-px flex-1 bg-[hsl(var(--border))]" />
      </div>

      <GoogleLoginButton locale={locale} next={next ?? undefined} />

      {emailConfigured() && <EmailLoginForm locale={locale} next={next ?? undefined} />}
    </div>
  );
}
