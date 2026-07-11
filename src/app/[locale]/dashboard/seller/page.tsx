import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { GigRowActions } from "@/components/gig-row-actions";
import { requireSellerUser } from "@/lib/auth-guards";
import { listSellerGigs } from "@/server/services/gig";
import { listSellerOrders, autoCompleteDeliveredOrders } from "@/server/services/order";
import { getSellerEarnings } from "@/server/services/payments";
import { getSellerStats, getSellerRevenueSeries } from "@/server/services/analytics";
import { RevenueTrend } from "@/components/revenue-trend";
import { getUserBadges, computeCompleteness } from "@/server/services/gamification";
import { GamificationStrip } from "@/components/gamification-strip";
import { myWeeklyRank } from "@/server/services/engagement";
import { getOwnProfile } from "@/server/services/profile";
import { getApprovalState } from "@/server/services/seller-approval";
import { SellerApprovalBanner } from "@/components/seller-approval-banner";
import { formatUzs } from "@/lib/utils";
import { xpLevel } from "@/lib/badges";
import { PayoutRequestButton } from "@/components/payout-request-button";
import { PriorityStrip, type PriorityItem } from "@/components/priority-strip";
import { FocusOrderRow } from "@/components/focus-order-row";
import { orderDueMeta, displayName, initialOf } from "@/lib/order-due";

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
  const revenue = await getSellerRevenueSeries(user.id);
  const profile = await getOwnProfile(user.id);
  const approval = await getApprovalState(user.id);

  const firstName = user.firstName || user.name || "";
  const level = xpLevel(user.xp, locale);

  // Onboarding checklist (computed from existing data; hidden once complete).
  const checklist = [
    { key: "profile", done: Boolean(profile?.headline || profile?.bio), href: "/dashboard/seller/profile" },
    {
      key: "portfolio",
      done: Boolean((profile?.portfolio?.length ?? 0) > 0 || profile?.telegramChannel || profile?.instagramUserId),
      href: "/dashboard/seller/portfolio",
    },
    { key: "gig", done: gigs.length > 0, href: "/dashboard/seller/gigs/new" },
    { key: "active", done: gigs.some((g) => g.status === "ACTIVE"), href: "/dashboard/seller" },
    { key: "sale", done: stats.completed > 0, href: "/dashboard/seller" },
  ];
  const onboardingComplete = checklist.every((c) => c.done);

  // --- Focus: what needs the seller right now ---
  const needDelivery = orders.filter((o) => o.status === "IN_PROGRESS" || o.status === "REVISION");
  const inReview = orders.filter((o) => o.status === "DELIVERED");
  const activeOrders = orders.filter((o) => !["COMPLETED", "CANCELLED"].includes(o.status));

  const priorities: PriorityItem[] = [];
  if (needDelivery.length) {
    const soonest = [...needDelivery].sort(
      (a, b) => (a.dueAt ? +new Date(a.dueAt) : Infinity) - (b.dueAt ? +new Date(b.dueAt) : Infinity),
    )[0];
    const due = orderDueMeta(soonest.status, soonest.dueAt, "seller", t);
    priorities.push({
      tone: "warn",
      tag: t("prioDeliverTag"),
      title: t("prioDeliverTitle", { n: needDelivery.length }),
      detail: [due?.text, soonest.gig.title].filter(Boolean).join(" · "),
      href: "/dashboard/seller#orders",
      cta: t("prioGoOrders"),
      ctaTone: "primary",
    });
  }
  if (earnings.availableUzs > 0) {
    priorities.push({
      tone: "money",
      tag: t("prioWithdrawTag"),
      title: `${formatUzs(earnings.availableUzs)} so'm`,
      detail: t("prioWithdrawDetail"),
      href: "/dashboard/seller#earnings",
      cta: t("prioWithdraw"),
      ctaTone: "coral",
    });
  }
  if (inReview.length) {
    priorities.push({
      tone: "info",
      tag: t("prioReviewTag"),
      title: t("prioInReview", { n: inReview.length }),
      detail: [inReview[0].gig.title, displayName(inReview[0].buyer, t("client"))].join(" · "),
      href: "/dashboard/seller#orders",
      cta: t("prioOpen"),
      ctaTone: "outline",
    });
  }

  const quickLink =
    "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-2))]";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{firstName ? t("helloName", { name: firstName }) : t("creator")}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
            <span>{t("creatorSub")}</span>
            <span className="rounded-full bg-[hsl(var(--primary))]/12 px-2 py-0.5 text-xs font-semibold text-[hsl(var(--primary-ink))]">
              {level.label}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.role === "ADMIN" && (
            <>
              <Link href="/admin/settlements">
                <Button variant="outline">{ta("title")}</Button>
              </Link>
              <Link href="/admin/moderation">
                <Button variant="outline">{ta("moderation")}</Button>
              </Link>
              <Link href="/admin/sellers">
                <Button variant="outline">{ta("sellersTitle")}</Button>
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
          <Link href="/dashboard/seller/portfolio">
            <Button variant="ghost">{tp("portfolio")}</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost">{t("buyerView")}</Button>
          </Link>
        </div>
      </div>

      <SellerApprovalBanner
        state={approval}
        pendingGigCount={gigs.filter((g) => g.status === "PENDING_REVIEW").length}
      />

      {!onboardingComplete && (
        <div className="mb-5 rounded-xl border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/5 p-5">
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

      <PriorityStrip items={priorities} />

      {/* Work + money */}
      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div
          id="orders"
          className="scroll-mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              {t("ordersToFulfill")}
            </h2>
          </div>
          {activeOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">{to("noSellerOrders")}</p>
          ) : (
            <ul>
              {activeOrders.slice(0, 8).map((o, i) => (
                <FocusOrderRow
                  key={o.id}
                  href={`/orders/${o.id}`}
                  title={o.gig.title}
                  status={o.status}
                  statusLabel={to(`status.${o.status}`)}
                  due={orderDueMeta(o.status, o.dueAt, "seller", t)}
                  counterpart={displayName(o.buyer, t("client"))}
                  initial={initialOf(displayName(o.buyer, t("client")))}
                  amountUzs={o.amountUzs}
                  variant={i}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="grid content-start gap-4">
          <div
            id="earnings"
            className="scroll-mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"
          >
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              {t("available")}
            </h2>
            <p className="text-3xl font-extrabold tabular-nums">
              {formatUzs(earnings.availableUzs)}{" "}
              <span className="text-base font-normal text-[hsl(var(--muted-foreground))]">so&apos;m</span>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[hsl(var(--surface-2))] px-3 py-2.5">
                <p className="text-lg font-bold tabular-nums">{formatUzs(earnings.heldUzs)}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{t("held")}</p>
              </div>
              <div className="rounded-xl bg-[hsl(var(--surface-2))] px-3 py-2.5">
                <p className="text-lg font-bold tabular-nums">{formatUzs(earnings.lifetimeUzs)}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{t("lifetime")}</p>
              </div>
            </div>
            <div className="mt-4">
              <PayoutRequestButton availableUzs={earnings.availableUzs} />
            </div>
          </div>

          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
            <h2 className="px-2 pb-1 pt-1 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              {t("quickActions")}
            </h2>
            <Link href="/dashboard/seller/gigs/new" className={quickLink}>
              <span>{tg("createGig")}</span>
              <span aria-hidden>→</span>
            </Link>
            <Link href="/dashboard/seller/portfolio" className={quickLink}>
              <span>{tp("portfolio")}</span>
              <span aria-hidden>→</span>
            </Link>
            <Link href="#analytics" className={quickLink}>
              <span>{t("analytics")}</span>
              <span aria-hidden>↓</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Gigs */}
      <div
        id="gigs"
        className="mt-4 scroll-mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t("gigs")}</h2>
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
                    <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">{g.status}</span>
                    <span
                      className="hidden tabular-nums text-xs sm:inline"
                      title={`${g.views} ${tg("views")} · ${g._count.orders} ${t("statOrders")}`}
                    >
                      👁 {g.views.toLocaleString()} · 🛒 {g._count.orders}
                    </span>
                    <span className="tabular-nums">
                      {tg("startingFrom")} {formatUzs(from)} so&apos;m
                    </span>
                    <GigRowActions gigId={g.id} status={g.status} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Analytics */}
      <div
        id="analytics"
        className="mt-4 scroll-mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"
      >
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          {t("analytics")}
        </h2>
        <RevenueTrend weeks={revenue.weeks} totalUzs={revenue.totalUzs} weekCount={revenue.weekCount} />
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

      {/* Rewards — the reward you scroll to, not the first thing you see */}
      <div className="mt-4">
        <GamificationStrip
          locale={locale}
          xp={user.xp}
          streakDays={user.streakDays}
          badges={sellerBadges}
          completeness={completeness}
          weeklyRank={weeklyRank}
        />
      </div>
    </div>
  );
}
