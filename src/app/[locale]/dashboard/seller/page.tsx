import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { DashCard } from "@/components/dash-card";
import { requireSellerUser } from "@/lib/auth-guards";
import { formatUzs } from "@/lib/utils";

export default async function SellerDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireSellerUser(locale);
  const t = await getTranslations("Dash");

  // Balances come from the SellerBalance rollup later; zeroes for now.
  const held = 0;
  const available = 0;
  const lifetime = 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{t("creator")}</h1>
        <Link href="/dashboard">
          <Button variant="ghost">{t("buyerView")}</Button>
        </Link>
      </div>

      {/* Earnings */}
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        {[
          { label: t("held"), value: held },
          { label: t("available"), value: available },
          { label: t("lifetime"), value: lifetime },
        ].map((b) => (
          <div
            key={b.label}
            className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"
          >
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{b.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {formatUzs(b.value)} <span className="text-base font-normal">so&apos;m</span>
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DashCard title={t("orders")} span />
        <DashCard title={t("gigs")} />
        <DashCard title={t("analytics")} />
        <DashCard title={t("reviews")} span />
      </div>
    </div>
  );
}
