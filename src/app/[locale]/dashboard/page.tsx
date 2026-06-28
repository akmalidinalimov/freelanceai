import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Auth gate: must be signed in.
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/login", locale });
    return null; // unreachable (redirect throws); narrows `user` for TS
  }

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
