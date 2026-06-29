import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";
import { TelegramLoginButton } from "@/components/telegram-login-button";

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

  const appUrl =
    process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const botUsername =
    process.env.TELEGRAM_BOT_USERNAME ?? process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const authUrl = `${appUrl}/api/auth/telegram`;

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

      <TelegramLoginButton authUrl={authUrl} botUsername={botUsername} />
    </div>
  );
}
