import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { DashCard } from "@/components/dash-card";
import { requireSellerUser } from "@/lib/auth-guards";
import { listSellerGigs } from "@/server/services/gig";
import { formatUzs } from "@/lib/utils";

export default async function SellerDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireSellerUser(locale);
  const t = await getTranslations("Dash");
  const tg = await getTranslations("Gig");
  const gigs = await listSellerGigs(user.id);

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
          { label: t("held"), value: 0 },
          { label: t("available"), value: 0 },
          { label: t("lifetime"), value: 0 },
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

      {/* Gigs */}
      <div className="mb-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{t("gigs")}</h3>
          <Link href="/dashboard/seller/gigs/new">
            <Button size="sm">{tg("createGig")}</Button>
          </Link>
        </div>
        {gigs.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{tg("noGigs")}</p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border))]">
            {gigs.map((g) => {
              const from = g.packages[0]?.priceUzs ?? 0;
              return (
                <li key={g.id} className="flex items-center justify-between py-3">
                  <Link href={`/gigs/${g.slug}`} className="font-medium hover:underline">
                    {g.title}
                  </Link>
                  <span className="flex items-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
                    <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">
                      {g.status}
                    </span>
                    <span className="tabular-nums">
                      {tg("from")} {formatUzs(from)} so&apos;m
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DashCard title={t("orders")} span />
        <DashCard title={t("analytics")} />
        <DashCard title={t("reviews")} />
      </div>
    </div>
  );
}
