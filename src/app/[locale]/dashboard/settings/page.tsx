import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireOnboardedUser } from "@/lib/auth-guards";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireOnboardedUser(locale);
  const t = await getTranslations("Settings");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">{t("title")}</h1>
      <p className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">{t("notifyTitle")}</p>
      <SettingsForm
        initial={{ notifyTelegram: user.notifyTelegram, notifyEmail: user.notifyEmail }}
        hasEmail={Boolean(user.email)}
        hasTelegram={Boolean(user.telegramId)}
      />
    </div>
  );
}
