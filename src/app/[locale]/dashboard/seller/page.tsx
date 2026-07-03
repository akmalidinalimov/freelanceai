import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { GigRowActions } from "@/components/gig-row-actions";
import { requireSellerUser } from "@/lib/auth-guards";
import { listSellerGigs } from "@/server/services/gig";
import { listSellerOrders, autoCompleteDeliveredOrders } from "@/server/services/order";
import { getSellerEarnings } from "@/server/services/payments";
import { getSellerStats } from "@/server/services/analytics";
import { getUserBadges, computeCompleteness } from "@/server/services/gamification";
import { GamificationStrip } from "@/components/gamification-strip";
import { myWeeklyRank } from "@/server/services/engagement";
import { getOwnProfile } from "@/server/services/profile";
import { formatUzs } from "@/lib/utils";
import { PayoutRequestButton } from "@/components/payout-request-button";

export default async function SellerDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireSellerUser(locale);
  const [sellerBadges, completeness, weeklyRank] = await Promise.all([
    getUserBadges(user.id).then((b) => b.filter((x) => x.key.startsWith("seller_"))),
    computeCompleteness(user.id).catch(() => null),
    myWeeklyRank(user.id).catch(() => null),
  ]);
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
  const profile = await getOwnProfile(user.id);

  // Onboarding checklist (computed from existing data; hidden once complete).
  const checklist = [
    { key: "profile", done: Boolean(profile?.headline || profile?.bio), href: "/dashboard/seller/profile" },
    { key: "gig", done: gigs.length > 0, href: "/dashboard/seller/gigs/new" },
    { key: "active", done: gigs.some((g) => g.status === "ACTIVE"), href: "/dashboard/seller" },
    { key: "sale", done: stats.completed > 0, href: "/dashboard/seller" },
  ];
  const onboardingComplete = checklist.every((c) => c.done);

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

      <GamificationStrip
        locale={locale}
        xp={user.xp}
        streakDays={user.streakDays}
        badges={sellerBadges}
        completeness={completeness}
        weeklyRank={weeklyRank}
      />

      {!onboardingComplete && (
        <div className="mb-4 rounded-xl border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/5 p-5">
          <h2 className="mb-3 font-semibold">{t("checklistTitle")}</h2>
          <ul className="space-y-2">
            {checklist.map((c) => (
              <li key={c.key} className="flex items-center gap-2 text-sm">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                    c.done
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "border border-[hsl(var(--border))]"
                  }`}
                >
                  {c.done ? "✓" : ""}
                </span>
                {c.done ? (
                  <span className="text-[hsl(var(--muted-foreground))] line-through">{t(`ck_${c.key}`)}</span>
                ) : (
                  <Link href={c.href} className="text-[hsl(var(--primary-ink))] hover:underline">
                    {t(`ck_${c.key}`)}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

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

      {/* Withdraw available balance */}
      <div className="mb-4">
        <PayoutRequestButton availableUzs={earnings.availableUzs} />
      </div>

      {/* Gigs */}
      <div id="gigs" className="mb-4 scroll-mt-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{t("gigs")}</h2>
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
      <div id="orders" className="mb-4 scroll-mt-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <h2 className="mb-3 font-semibold">{t("orders")}</h2>
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
        <h2 className="mb-3 font-semibold">{t("analytics")}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: t("statViews"), value: stats.views.toLocaleString() },
            { label: t("statOrders"), value: stats.totalOrders.toLocaleString() },
            { label: t("statActive"), value: stats.active.toLocaleString() },
            { label: t("statCompleted"), value: stats.completed.toLocaleString() },
            { label: t("statActiveGigs"), value: stats.activeGigs.toLocaleString() },
            { label: t("statConversion"), value: `${stats.conversionPct}%` },
            { label: t("stat30dOrders"), value: stats.last30.orders.toLocaleString() },
            { label: t("stat30dCompleted"), value: stats.last30.completed.toLocaleString() },
            { label: t("stat30dRevenue"), value: `${formatUzs(stats.last30.revenueUzs)}` },
            { label: t("stat30dContacts"), value: stats.last30.contacts.toLocaleString() },
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
