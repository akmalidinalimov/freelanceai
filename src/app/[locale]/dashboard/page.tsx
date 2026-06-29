import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { DashCard } from "@/components/dash-card";
import { requireOnboardedUser } from "@/lib/auth-guards";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireOnboardedUser(locale);
  const t = await getTranslations("Dash");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{t("buyer")}</h1>
        {!user.isSeller && (
          <Link href="/sell">
            <Button variant="outline">{t("becomeCreator")}</Button>
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DashCard title={t("orders")} span />
        <DashCard title={t("messages")} />
        <DashCard title={t("saved")} />
        <DashCard title={t("spend")} />
      </div>
    </div>
  );
}
