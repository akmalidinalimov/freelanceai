import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";
import { TelegramDeepLinkLogin } from "@/components/telegram-deeplink-login";
import { GoogleLoginButton } from "@/components/google-login-button";
import { EmailLoginForm } from "@/components/email-login-form";
import { emailConfigured } from "@/lib/email";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Already signed in → go home.
  const user = await getCurrentUser();
  if (user) redirect({ href: "/", locale });

  const { error } = await searchParams;
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

      {error === "auth" && (
        <p className="w-full rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
          Authentication failed. Please try again.
        </p>
      )}

      <TelegramDeepLinkLogin locale={locale} />

      <div className="flex w-full items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
        <span className="h-px flex-1 bg-[hsl(var(--border))]" />
        {ta("or")}
        <span className="h-px flex-1 bg-[hsl(var(--border))]" />
      </div>

      <GoogleLoginButton locale={locale} />

      {emailConfigured() && <EmailLoginForm locale={locale} />}
    </div>
  );
}
