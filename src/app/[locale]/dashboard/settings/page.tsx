import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireOnboardedUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
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

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { notifyPrefs: true, phone: true, payoutCardMasked: true, kycStatus: true },
  });
  const p = (dbUser?.notifyPrefs as { orders?: boolean; messages?: boolean; reviews?: boolean } | null) ?? null;
  const prefs = { orders: p?.orders ?? true, messages: p?.messages ?? true, reviews: p?.reviews ?? true };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">{t("title")}</h1>
      <p className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">{t("notifyTitle")}</p>
      <SettingsForm
        initial={{
          notifyTelegram: user.notifyTelegram,
          notifyEmail: user.notifyEmail,
          prefs,
          phone: dbUser?.phone ?? "",
          payoutCardMasked: dbUser?.payoutCardMasked ?? "",
          kycStatus: dbUser?.kycStatus ?? "NONE",
        }}
        isSeller={user.isSeller}
        hasEmail={Boolean(user.email)}
        hasTelegram={Boolean(user.telegramId)}
      />
    </div>
  );
}
