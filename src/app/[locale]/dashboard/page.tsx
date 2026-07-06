import { setRequestLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { requireOnboardedUser } from "@/lib/auth-guards";
import { listBuyerOrders } from "@/server/services/order";
import { listSavedGigs } from "@/server/services/saved";
import { getReferralInfo, applyReferral } from "@/server/services/referral";
import { getAffiliateSummary } from "@/server/services/affiliate";
import { getBuyerStats } from "@/server/services/analytics";
import { getUserBadges } from "@/server/services/gamification";
import { GamificationStrip } from "@/components/gamification-strip";
import { buildFeed } from "@/server/services/engagement";
import { FeedSectionsView } from "@/components/feed-sections";
import { PriorityStrip, type PriorityItem } from "@/components/priority-strip";
import { FocusOrderRow } from "@/components/focus-order-row";
import { orderDueMeta, displayName, initialOf } from "@/lib/order-due";
import { formatUzs } from "@/lib/utils";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireOnboardedUser(locale);
  const t = await getTranslations("Dash");
  const to = await getTranslations("Order");
  const tm = await getTranslations("Message");
  const ts = await getTranslations("Settings");
  const tg = await getTranslations("Gig");
  const tr = await getTranslations("Referral");
  // Attribute a pending referral (set-once) from the `ref` cookie, then load the invite info.
  const ref = (await cookies()).get("ref")?.value;
  if (ref) await applyReferral(user.id, ref);
  const referral = await getReferralInfo(user.id);
  const affiliate = await getAffiliateSummary(user.id);
  const origin = process.env.APP_ORIGIN ?? "https://gigora.ai";
  const referralUrl = referral.code ? `${origin}/${locale}/r/${referral.code}` : null;

  const orders = await listBuyerOrders(user.id);
  const saved = await listSavedGigs(user.id);
  const bstats = await getBuyerStats(user.id);
  const myBadges = (await getUserBadges(user.id)).filter((b) => !b.key.startsWith("seller_"));
  const feed = await buildFeed(user.id).catch(() => null);

  const firstName = user.firstName || user.name || "";

  // --- Focus: what needs the buyer right now ---
  const inProgress = orders.filter((o) => ["IN_PROGRESS", "PAID", "REVISION"].includes(o.status));
  const toReview = orders.filter((o) => o.status === "DELIVERED" || (o.status === "COMPLETED" && !o.review));
  const activeOrders = orders.filter((o) => !["COMPLETED", "CANCELLED"].includes(o.status));

  const priorities: PriorityItem[] = [];
  if (inProgress.length) {
    const soonest = [...inProgress].sort(
      (a, b) => (a.dueAt ? +new Date(a.dueAt) : Infinity) - (b.dueAt ? +new Date(b.dueAt) : Infinity),
    )[0];
    const due = orderDueMeta(soonest.status, soonest.dueAt, "buyer", t);
    priorities.push({
      tone: "info",
      tag: t("prioInProgressTag"),
      title: t("prioInProgress", { n: inProgress.length }),
      detail: [soonest.gig.title, due?.text].filter(Boolean).join(" · "),
      href: `/orders/${soonest.id}`,
      cta: t("prioTrack"),
      ctaTone: "primary",
    });
  }
  if (toReview.length) {
    const o0 = toReview[0];
    priorities.push({
      tone: "warn",
      tag: t("prioActionTag"),
      title: t("prioToReview", { n: toReview.length }),
      detail: [o0.gig.title, displayName(o0.seller, t("seller"))].join(" · "),
      href: `/orders/${o0.id}`,
      cta: t("prioReviewNow"),
      ctaTone: "coral",
    });
  }
  if (referralUrl) {
    priorities.push({
      tone: "money",
      tag: t("prioCreditTag"),
      title: `${formatUzs(affiliate.balanceUzs)} so'm`,
      detail: t("prioCreditDetail", { n: referral.count }),
      href: "/dashboard#invite",
      cta: t("prioInvite"),
      ctaTone: "outline",
    });
  }

  const activityStats = [
    { label: t("bstatSpent"), value: `${formatUzs(bstats.spentUzs)}` },
    { label: t("bstatCompleted"), value: bstats.ordersCompleted.toLocaleString() },
    ...(bstats.refundedCount > 0 ? [{ label: t("bstatRefunded"), value: `${formatUzs(bstats.refundedUzs)}` }] : []),
    { label: t("bstatContacted"), value: bstats.sellersContacted.toLocaleString() },
    { label: t("bstatSaved"), value: bstats.savedGigs.toLocaleString() },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{firstName ? t("helloName", { name: firstName }) : t("buyer")}</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t("buyerSub")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/messages">
            <Button variant="ghost">{tm("inbox")}</Button>
          </Link>
          <Link href="/dashboard/settings">
            <Button variant="ghost">{ts("title")}</Button>
          </Link>
          {!user.isSeller && (
            <Link href="/sell">
              <Button variant="outline">{t("becomeCreator")}</Button>
            </Link>
          )}
        </div>
      </div>

      <PriorityStrip items={priorities} />

      {/* Work + activity */}
      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              {t("yourOrders")}
            </h2>
            <Link href="/gigs" className="text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
              {to("browse")} →
            </Link>
          </div>
          {activeOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
              {to("noOrders")}{" "}
              <Link href="/gigs" className="text-[hsl(var(--primary-ink))] hover:underline">
                {to("browse")}
              </Link>
            </p>
          ) : (
            <ul>
              {activeOrders.slice(0, 8).map((o, i) => (
                <FocusOrderRow
                  key={o.id}
                  href={`/orders/${o.id}`}
                  title={o.gig.title}
                  status={o.status}
                  statusLabel={to(`status.${o.status}`)}
                  due={orderDueMeta(o.status, o.dueAt, "buyer", t)}
                  counterpart={displayName(o.seller, t("seller"))}
                  initial={initialOf(displayName(o.seller, t("seller")))}
                  amountUzs={o.amountUzs}
                  variant={i}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="grid content-start gap-4">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              {t("yourActivity")}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {activityStats.map((s) => (
                <div key={s.label} className="rounded-xl bg-[hsl(var(--surface-2))] px-3 py-2.5">
                  <p className="text-lg font-bold tabular-nums">{s.value}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          {referralUrl && (
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--primary))]/[0.06] p-5">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[hsl(var(--primary-ink))]">
                {tr("creditBalance")}
              </h2>
              <p className="text-2xl font-extrabold tabular-nums text-[hsl(var(--primary-ink))]">
                {formatUzs(affiliate.balanceUzs)}{" "}
                <span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">so&apos;m</span>
              </p>
              <Link href="/dashboard#invite" className="mt-3 inline-block text-sm font-semibold text-[hsl(var(--primary-ink))] hover:underline">
                {tr("inviteTitle")} →
              </Link>
            </div>
          )}
        </div>
      </div>

      {referralUrl && (
        <div id="invite" className="mt-4 scroll-mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">{tr("inviteTitle")}</h2>
            <span className="text-sm text-[hsl(var(--muted-foreground))]">{tr("invited", { n: referral.count })}</span>
          </div>
          <p className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">{tr("inviteDesc")}</p>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-[hsl(var(--muted))]/50 px-3 py-2">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{tr("creditBalance")}</p>
              <p className="text-lg font-bold tabular-nums">{formatUzs(affiliate.balanceUzs)} so&apos;m</p>
            </div>
            <div className="rounded-lg bg-[hsl(var(--muted))]/50 px-3 py-2">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{tr("earned")}</p>
              <p className="text-lg font-bold tabular-nums">{formatUzs(affiliate.earnedUzs)} so&apos;m</p>
            </div>
          </div>
          <input
            readOnly
            value={referralUrl}
            aria-label={tr("inviteTitle")}
            className="w-full rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 py-2 text-sm"
          />
        </div>
      )}

      {feed && (
        <div className="mt-4">
          <FeedSectionsView feed={feed} />
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{t("saved")}</h2>
          <Link href="/dashboard/saved" className="text-sm text-[hsl(var(--primary-ink))] hover:underline">
            {t("manageSaved")}
          </Link>
        </div>
        {saved.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{tg("noSaved")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {saved.map((g) => {
              const from = g.packages[0]?.priceUzs ?? 0;
              return (
                <Link
                  key={g.id}
                  href={`/gigs/${g.slug}`}
                  className="flex flex-col rounded-xl border border-[hsl(var(--border))] p-3 transition-colors hover:border-[hsl(var(--primary))]"
                >
                  <div className="mb-2 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[hsl(var(--primary))]/15 to-[hsl(var(--accent))]/15 text-lg font-bold text-[hsl(var(--primary-ink))]">
                    {g.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.coverUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      g.title.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm font-medium">{g.title}</p>
                  <p className="mt-auto pt-1 text-sm font-semibold tabular-nums">
                    {tg("startingFrom")} {formatUzs(from)} so&apos;m
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4">
        <GamificationStrip locale={locale} xp={user.xp} streakDays={user.streakDays} badges={myBadges} />
      </div>
    </div>
  );
}
