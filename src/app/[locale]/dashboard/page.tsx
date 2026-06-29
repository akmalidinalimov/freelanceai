import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireOnboardedUser } from "@/lib/auth-guards";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Auth + onboarding gate (not signed in → /login; not onboarded → /onboarding).
  const user = await requireOnboardedUser(locale);

  const t = await getTranslations("Nav");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">{t("dashboard")}</h1>
      <div className="mt-6 rounded-lg border border-[hsl(var(--border))] p-6">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Signed in as
        </p>
        <p className="text-lg font-semibold">
          {user.firstName} {user.lastName}{" "}
          {user.username ? `(@${user.username})` : ""}
        </p>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Telegram ID: {user.telegramId} · Role: {user.role}
        </p>
      </div>
    </div>
  );
}
