import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashCard } from "@/components/dash-card";
import { requireAdminUser } from "@/lib/auth-guards";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireAdminUser(locale);
  const t = await getTranslations("Dash");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">{t("admin")}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashCard title={t("metrics")} span />
        <DashCard title={t("users")} />
        <DashCard title={t("moderation")} />
        <DashCard title={t("disputes")} />
        <DashCard title={t("payouts")} />
        <DashCard title={t("kyc")} />
      </div>
    </div>
  );
}
