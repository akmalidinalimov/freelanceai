import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { requireAdminUser } from "@/lib/auth-guards";
import { getAdminStats, getAdminActivityStats } from "@/server/services/analytics";
import { getPairStats, getCategoryStats } from "@/server/services/admin-conversations";
import { formatUzs } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminUser(locale);
  const t = await getTranslations("Admin");
  const td = await getTranslations("Dispute");
  // Core stats stay fatal; the two insight tables degrade to empty so a failure
  // there can't take down the incident-response entry point.
  const [stats, act, pairs, categories] = await Promise.all([
    getAdminStats(),
    getAdminActivityStats(),
    getPairStats().catch(() => []),
    getCategoryStats().catch(() => []),
  ]);

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
          <Link href="/admin/categories">
            <Button variant="outline" size="sm">Categories</Button>
          </Link>
          <Link href="/admin/kyc">
            <Button variant="outline" size="sm">KYC</Button>
          </Link>
          <Link href="/admin/users">
            <Button variant="outline" size="sm">{t("users")}</Button>
          </Link>
          <Link href="/admin/conversations">
            <Button variant="outline" size="sm">Conversations</Button>
          </Link>
          <Link href="/admin/flags">
            <Button variant="outline" size="sm">Red flags</Button>
          </Link>
          <Link href="/admin/broadcast">
            <Button variant="outline" size="sm">Broadcast</Button>
          </Link>
          <Link href="/admin/audit">
            <Button variant="outline" size="sm">{t("audit")}</Button>
          </Link>
          <Link href="/admin/search-debug">
            <Button variant="outline" size="sm">Search debug</Button>
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

      {/* Activity — who is actually using the platform */}
      <h2 className="mb-2 mt-6 text-lg font-bold">Activity</h2>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Active 3d", value: act.activeUsers.d3 },
          { label: "Active 7d", value: act.activeUsers.d7 },
          { label: "Active 14d", value: act.activeUsers.d14 },
          { label: "Active 30d", value: act.activeUsers.d30 },
          { label: "New users 24h", value: act.registrations.d1 },
          { label: "New users 7d", value: act.registrations.d7 },
          { label: "New users 30d", value: act.registrations.d30 },
          { label: "Telegram-linked", value: act.telegramLinked },
          { label: "Contacts 7d", value: act.contacts.d7 },
          { label: "Contacts 30d", value: act.contacts.d30 },
          { label: "Messages 7d", value: act.messages.d7 },
          { label: "KYC verified", value: act.kycVerified },
        ].map((c) => (
          <div key={c.label} className="rounded-lg bg-[hsl(var(--muted))]/40 p-4">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{c.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{c.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Conversion funnel (last 30 days) */}
      <h2 className="mb-2 mt-6 text-lg font-bold">Funnel — last 30 days</h2>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { label: "Order-button clicks", value: act.funnel.orderCtaClicks },
          { label: "Orders created", value: act.funnel.ordersCreated },
          { label: "Orders paid", value: act.funnel.ordersPaid },
          { label: "Contact clicks", value: act.funnel.contactCtaClicks },
          { label: "Conversations started", value: act.funnel.conversationsStarted },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-[hsl(var(--border))] p-4">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{c.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{c.value.toLocaleString()}</p>
          </div>
        ))}
      </div>
      <p className="mb-6 text-xs text-[hsl(var(--muted-foreground))]">
        Click→order conversion:{" "}
        <b>
          {act.funnel.orderCtaClicks > 0
            ? `${Math.round((act.funnel.ordersCreated / act.funnel.orderCtaClicks) * 100)}%`
            : "n/a (no clicks tracked yet)"}
        </b>
        {" · "}Created→paid:{" "}
        <b>
          {act.funnel.ordersCreated > 0
            ? `${Math.round((act.funnel.ordersPaid / act.funnel.ordersCreated) * 100)}%`
            : "n/a"}
        </b>
      </p>

      {/* By category — where supply and money actually are */}
      <h2 className="mb-2 mt-6 text-lg font-bold">By category</h2>
      {categories.length === 0 ? (
        <p className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">No category data yet.</p>
      ) : (
        <div className="mb-6 overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]/40 text-left text-xs text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium tabular-nums">Active gigs</th>
                <th className="px-3 py-2 font-medium tabular-nums">Paid orders</th>
                <th className="px-3 py-2 font-medium tabular-nums">Paid volume</th>
                <th className="px-3 py-2 font-medium tabular-nums">Completed GMV</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-t border-[hsl(var(--border))]">
                  <td className="px-3 py-2">{c.nameEn}</td>
                  <td className="px-3 py-2 tabular-nums">{c.activeGigs}</td>
                  <td className="px-3 py-2 tabular-nums">{c.paidOrders}</td>
                  <td className="px-3 py-2 tabular-nums">{formatUzs(c.paidUzs)} so&apos;m</td>
                  <td className="px-3 py-2 tabular-nums">{formatUzs(c.completedUzs)} so&apos;m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Top buyer↔seller pairs — repeat relationships (and dispute hotspots) */}
      <h2 className="mb-2 mt-6 text-lg font-bold">Top buyer↔seller pairs</h2>
      {pairs.length === 0 ? (
        <p className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">No paid orders yet.</p>
      ) : (
        <div className="mb-6 overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]/40 text-left text-xs text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-3 py-2 font-medium">Buyer</th>
                <th className="px-3 py-2 font-medium">Seller</th>
                <th className="px-3 py-2 font-medium tabular-nums">Orders</th>
                <th className="px-3 py-2 font-medium tabular-nums">Paid volume</th>
                <th className="px-3 py-2 font-medium tabular-nums">Completed</th>
                <th className="px-3 py-2 font-medium tabular-nums">Disputed</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p, i) => (
                <tr key={i} className="border-t border-[hsl(var(--border))]">
                  <td className="px-3 py-2">
                    {p.buyer ? (
                      <Link href={`/admin/users/${p.buyer.id}`} className="hover:underline">
                        {p.buyer.username ? `@${p.buyer.username}` : (p.buyer.firstName ?? p.buyer.email ?? "—")}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {p.seller ? (
                      <Link href={`/admin/users/${p.seller.id}`} className="hover:underline">
                        {p.seller.username ? `@${p.seller.username}` : (p.seller.firstName ?? p.seller.email ?? "—")}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{p.orders}</td>
                  <td className="px-3 py-2 tabular-nums">{formatUzs(p.paidUzs)} so&apos;m</td>
                  <td className="px-3 py-2 tabular-nums">{p.completed}</td>
                  <td className={`px-3 py-2 tabular-nums ${p.disputed > 0 ? "font-bold text-red-700" : ""}`}>
                    {p.disputed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
