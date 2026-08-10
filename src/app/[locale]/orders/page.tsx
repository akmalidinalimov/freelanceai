import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireOnboardedUser } from "@/lib/auth-guards";
import { listBuyerOrdersPage, ORDER_TABS, type OrderTab } from "@/server/services/order";
import { orderDueMeta, displayName, initialOf } from "@/lib/order-due";
import { FocusOrderRow } from "@/components/focus-order-row";
import { EmptyState } from "@/components/empty-state";
import { Package } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * The buyer's orders. This route did not exist: orders were reachable only from a dashboard
 * widget that shows ACTIVE ones (max 8) and drops completed ones entirely, and the mobile tab
 * bar had no link at all — so a phone-only buyer had no path back to something they had paid
 * for (audit 2026-08-10, S6). Sellers manage incoming work at /dashboard/seller.
 */
export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireOnboardedUser(locale);
  const sp = await searchParams;
  const t = await getTranslations("Order");
  const td = await getTranslations("Dash");
  const tn = await getTranslations("Nav");

  const tab: OrderTab = (ORDER_TABS as readonly string[]).includes(sp.tab ?? "")
    ? (sp.tab as OrderTab)
    : "active";
  const page = Number.parseInt(sp.page ?? "1", 10) || 1;
  const { orders, page: current, pageCount, tabCounts } = await listBuyerOrdersPage(user.id, tab, page);

  const chip = "rounded-full px-3 py-1.5 text-sm font-medium";
  const tabClass = (k: OrderTab) =>
    k === tab
      ? `${chip} bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]`
      : `${chip} bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]`;
  const href = (k: OrderTab, p = 1) => `/orders?tab=${k}${p > 1 ? `&page=${p}` : ""}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold">{td("yourOrders")}</h1>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {ORDER_TABS.map((k) => (
          <Link key={k} href={href(k)} className={tabClass(k)} aria-current={k === tab ? "page" : undefined}>
            {t(`tab.${k}`)} {tabCounts[k] > 0 && <span className="tabular-nums opacity-70">{tabCounts[k]}</span>}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={Package} title={t(`empty.${tab}`)} ctaLabel={tn("explore")} ctaHref="/gigs" />
      ) : (
        <>
          <ul>
            {orders.map((o, i) => (
              <FocusOrderRow
                key={o.id}
                href={`/orders/${o.id}`}
                title={o.gig?.title ?? o.packageTitle}
                status={o.status}
                statusLabel={t(`status.${o.status}`)}
                due={orderDueMeta(o.status, o.dueAt, "buyer", t)}
                counterpart={displayName(o.seller, t("seller"))}
                initial={initialOf(o.gig?.title ?? o.packageTitle)}
                amountUzs={o.amountUzs}
                variant={i}
              />
            ))}
          </ul>

          {pageCount > 1 && (
            <nav className="mt-6 flex items-center justify-between gap-3" aria-label={t("pagination")}>
              {current > 1 ? (
                <Link href={href(tab, current - 1)} className={`${chip} bg-[hsl(var(--muted))]`}>
                  {t("prevPage")}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm tabular-nums text-[hsl(var(--muted-foreground))]">
                {current} / {pageCount}
              </span>
              {current < pageCount ? (
                <Link href={href(tab, current + 1)} className={`${chip} bg-[hsl(var(--muted))]`}>
                  {t("nextPage")}
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
