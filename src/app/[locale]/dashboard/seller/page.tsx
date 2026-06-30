import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { GigRowActions } from "@/components/gig-row-actions";
import { requireSellerUser } from "@/lib/auth-guards";
import { listSellerGigs } from "@/server/services/gig";
import { listSellerOrders, autoCompleteDeliveredOrders } from "@/server/services/order";
import { getSellerEarnings } from "@/server/services/payments";
import { getSellerStats } from "@/server/services/analytics";
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
  const to = await getTranslations("Order");
  const ta = await getTranslations("Admin");
  const tm = await getTranslations("Message");
  const tp = await getTranslations("Profile");
  const td = await getTranslations("Dispute");
  // Lazy fallback so overdue deliveries complete even without the scheduled cron.
  await autoCompleteDeliveredOrders().catch(() => 0);
  const gigs = await listSellerGigs(user.id);
  const orders = await listSellerOrders(user.id);
  const earnings = await getSellerEarnings(user.id);
  const stats = await getSellerStats(user.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{t("creator")}</h1>
        <div className="flex gap-2">
          {user.role === "ADMIN" && (
            <>
              <Link href="/admin/settlements">
                <Button variant="outline">{ta("title")}</Button>
              </Link>
              <Link href="/admin/moderation">
                <Button variant="outline">{ta("moderation")}</Button>
              </Link>
              <Link href="/admin/disputes">
                <Button variant="outline">{td("adminTitle")}</Button>
              </Link>
            </>
          )}
          <Link href="/messages">
            <Button variant="ghost">{tm("inbox")}</Button>
          </Link>
          <Link href="/dashboard/seller/profile">
            <Button variant="ghost">{tp("editTitle")}</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost">{t("buyerView")}</Button>
          </Link>
        </div>
      </div>

      {/* Earnings */}
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        {[
          { label: t("held"), value: earnings.heldUzs },
          { label: t("available"), value: earnings.availableUzs },
          { label: t("lifetime"), value: earnings.lifetimeUzs },
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
                    <span
                      className="hidden tabular-nums text-xs sm:inline"
                      title={`${g.views} ${tg("views")} · ${g._count.orders} ${t("statOrders")}`}
                    >
                      👁 {g.views.toLocaleString()} · 🛒 {g._count.orders}
                    </span>
                    <span className="tabular-nums">
                      {tg("from")} {formatUzs(from)} so&apos;m
                    </span>
                    <GigRowActions gigId={g.id} status={g.status} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Orders to fulfill */}
      <div className="mb-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <h3 className="mb-3 font-semibold">{t("orders")}</h3>
        {orders.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{to("noSellerOrders")}</p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border))]">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-3">
                <Link href={`/orders/${o.id}`} className="font-medium hover:underline">
                  {o.gig.title}
                </Link>
                <span className="flex items-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
                  <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">
                    {to(`status.${o.status}`)}
                  </span>
                  <span className="tabular-nums">{formatUzs(o.amountUzs)} so&apos;m</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Analytics */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <h3 className="mb-3 font-semibold">{t("analytics")}</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: t("statViews"), value: stats.views.toLocaleString() },
            { label: t("statOrders"), value: stats.totalOrders.toLocaleString() },
            { label: t("statActive"), value: stats.active.toLocaleString() },
            { label: t("statCompleted"), value: stats.completed.toLocaleString() },
            { label: t("statActiveGigs"), value: stats.activeGigs.toLocaleString() },
            { label: t("statConversion"), value: `${stats.conversionPct}%` },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-[hsl(var(--muted))]/40 p-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
