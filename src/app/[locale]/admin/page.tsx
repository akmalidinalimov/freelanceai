import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { requireAdminUser } from "@/lib/auth-guards";
import { getAdminStats } from "@/server/services/analytics";
import { formatUzs } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminUser(locale);
  const t = await getTranslations("Admin");
  const td = await getTranslations("Dispute");
  const stats = await getAdminStats();

  const money = [
    { label: t("gmv"), value: `${formatUzs(stats.gmvUzs)} so'm` },
    { label: t("platformRevenue"), value: `${formatUzs(stats.platformRevenueUzs)} so'm` },
  ];
  const counts = [
    { label: t("orders"), value: stats.totalOrders },
    { label: t("users"), value: stats.users },
    { label: t("sellers"), value: stats.sellers },
    { label: t("activeGigs"), value: stats.gigsActive },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{t("dashboard")}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/settlements">
            <Button variant="outline" size="sm">{t("title")}</Button>
          </Link>
          <Link href="/admin/moderation">
            <Button variant="outline" size="sm">{t("moderation")}</Button>
          </Link>
          <Link href="/admin/disputes">
            <Button variant="outline" size="sm">{td("adminTitle")}</Button>
          </Link>
          <Link href="/admin/coupons">
            <Button variant="outline" size="sm">{t("coupons")}</Button>
          </Link>
          <Link href="/admin/users">
            <Button variant="outline" size="sm">{t("users")}</Button>
          </Link>
        </div>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        {money.map((m) => (
          <div key={m.label} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{m.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {counts.map((c) => (
          <div key={c.label} className="rounded-lg bg-[hsl(var(--muted))]/40 p-4">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{c.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{c.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Ledger integrity — every order's double-entry postings must net to zero. */}
      <div
        className={`rounded-xl border p-5 ${
          stats.ledgerImbalanced === 0
            ? "border-[hsl(var(--border))] bg-[hsl(var(--card))]"
            : "border-red-500 bg-red-500/10"
        }`}
      >
        <p className="text-sm font-medium">{t("ledgerIntegrity")}</p>
        <p className="mt-1 text-sm">
          {stats.ledgerImbalanced === 0
            ? t("ledgerOk", { n: stats.ledgerOrders })
            : t("ledgerBad", { n: stats.ledgerImbalanced })}
        </p>
      </div>
    </div>
  );
}
