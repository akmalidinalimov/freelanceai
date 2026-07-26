import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdminUser } from "@/lib/auth-guards";
import { getAdminStats, getAdminActivityStats, getActionInbox } from "@/server/services/analytics";
import { ModerationActions } from "@/components/moderation-actions";
import { AdminSellerActions } from "@/components/admin-seller-actions";
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
  const [stats, act, pairs, categories, inbox] = await Promise.all([
    getAdminStats(),
    getAdminActivityStats(),
    getPairStats().catch(() => []),
    getCategoryStats().catch(() => []),
    getActionInbox().catch(() => null),
  ]);
  const who = (u: { firstName: string | null; name: string | null; username: string | null }) =>
    u.firstName ?? u.name ?? u.username ?? "—";

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
    <div className="mx-auto max-w-5xl px-0 py-6 lg:px-4">
      {/* Navigation lives in the admin sidebar (admin/layout.tsx). */}
      <h1 className="mb-6 text-3xl font-bold">{t("dashboard")}</h1>

      {/* Action inbox — the day's work, actionable right here. */}
      {inbox && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">{t("inboxTitle")}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Gig moderation */}
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="font-semibold">{t("moderation")} ({inbox.counts.gigs})</h3>
                {inbox.counts.gigs > 0 && (
                  <Link href="/admin/moderation" className="text-xs text-[hsl(var(--primary-ink))] hover:underline">
                    {t("inboxAll")} →
                  </Link>
                )}
              </div>
              {inbox.gigs.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">✅ {t("inboxEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {inbox.gigs.map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm">
                        {g.title}
                        <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">· {who(g.seller)}</span>
                      </span>
                      <ModerationActions gigId={g.id} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Seller approval */}
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="font-semibold">{t("sellersTitle")} ({inbox.counts.sellers})</h3>
                {inbox.counts.sellers > 0 && (
                  <Link href="/admin/sellers" className="text-xs text-[hsl(var(--primary-ink))] hover:underline">
                    {t("inboxAll")} →
                  </Link>
                )}
              </div>
              {inbox.sellers.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">✅ {t("inboxEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {inbox.sellers.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm">
                        <Link href={`/admin/users/${s.user.id}`} className="font-medium text-[hsl(var(--primary-ink))] hover:underline">
                          {who(s.user)}
                        </Link>
                        {s.headline && <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">· {s.headline}</span>}
                      </span>
                      <AdminSellerActions profileId={s.id} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* KYC */}
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="font-semibold">KYC ({inbox.counts.kyc})</h3>
                {inbox.counts.kyc > 0 && (
                  <Link href="/admin/kyc" className="text-xs text-[hsl(var(--primary-ink))] hover:underline">
                    {t("inboxAll")} →
                  </Link>
                )}
              </div>
              {inbox.kyc.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">✅ {t("inboxEmpty")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {inbox.kyc.map((u) => (
                    <li key={u.id} className="text-sm">
                      <Link href={`/admin/users/${u.id}`} className="text-[hsl(var(--primary-ink))] hover:underline">
                        {who(u)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Disputes */}
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="font-semibold">{td("adminTitle")} ({inbox.counts.disputes})</h3>
                {inbox.counts.disputes > 0 && (
                  <Link href="/admin/disputes" className="text-xs text-[hsl(var(--primary-ink))] hover:underline">
                    {t("inboxAll")} →
                  </Link>
                )}
              </div>
              {inbox.disputes.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">✅ {t("inboxEmpty")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {inbox.disputes.map((d) => (
                    <li key={d.id} className="text-sm">
                      <Link href={`/orders/${d.orderId}`} className="text-[hsl(var(--primary-ink))] hover:underline">
                        {d.order.gig.title}
                      </Link>
                      <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">· {d.reason.slice(0, 60)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

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
                  <td className={`px-3 py-2 tabular-nums ${p.disputed > 0 ? "font-bold text-[hsl(var(--danger))]" : ""}`}>
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
            : "border-[hsl(var(--danger))] bg-[hsl(var(--danger))]/10"
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
