import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireAdminUser } from "@/lib/auth-guards";
import { ApiError } from "@/lib/api";
import { getUserDetailForAdmin } from "@/server/services/admin-users";
import { AdminUserManage } from "@/components/admin-user-manage";
import { formatUzs } from "@/lib/utils";

export const dynamic = "force-dynamic";

const dt = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] p-3">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="mt-0.5 truncate text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

/** Human-readable labels for the merged activity feed (fallback: prettified raw type). */
const EVENT_LABELS: Record<string, string> = {
  sign_in: "Signed in",
  order_created: "Placed an order",
  message_redacted: "Sent a message with contact info (redacted)",
  seller_ready_nudge: "Became eligible to submit storefront",
  pay_reminder: "Was reminded to pay",
  order_reminder: "Got a delivery-deadline reminder",
  review_nudge: "Was nudged to review",
  streak_nudge: "Got a streak reminder",
  "gig.create": "Created a gig",
  "order.create": "Placed an order",
  "order.deliver": "Delivered an order",
  "order.accept": "Accepted a delivery",
  "order.revision": "Requested a revision",
  "order.cancel": "Cancelled an order",
  "seller.submit_for_approval": "Submitted storefront for approval",
  "onboarding.become_seller": "Became a creator",
  "onboarding.buyer": "Onboarded as buyer",
};
const readable = (type: string) => EVENT_LABELS[type] ?? type.replace(/[._]/g, " ");

function StatusRow({ map }: { map: Record<string, number> }) {
  const entries = Object.entries(map);
  if (entries.length === 0) return <p className="text-sm text-[hsl(var(--muted-foreground))]">none</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([k, v]) => (
        <span key={k} className="rounded-full border border-[hsl(var(--border))] px-2.5 py-1 text-xs font-medium">
          {k}: <b className="tabular-nums">{v}</b>
        </span>
      ))}
    </div>
  );
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const admin = await requireAdminUser(locale);
  // Only a genuine NOT_FOUND becomes a 404 — DB failures must surface, not masquerade.
  const d = await getUserDetailForAdmin(admin, id).catch((e) => {
    if (e instanceof ApiError && e.code === "NOT_FOUND") return null;
    throw e;
  });
  if (!d) notFound();
  const u = d.identity;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="mb-2 text-sm">
        <Link href="/admin/users" className="text-[hsl(var(--primary-ink))] hover:underline">
          ← All users
        </Link>
      </p>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{u.name || "(no name)"}</h1>
        {u.username && <span className="text-[hsl(var(--muted-foreground))]">@{u.username}</span>}
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.status === "ACTIVE" ? "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" : "bg-[hsl(var(--danger-soft))] text-[hsl(var(--danger))]"}`}>
          {u.status}
        </span>
        <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs font-semibold">
          {u.role === "ADMIN" ? "ADMIN" : u.isSeller ? "SELLER" : "BUYER"}
        </span>
        <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">KYC: {u.kycStatus}</span>
      </div>
      <p className="mb-6 text-xs text-[hsl(var(--muted-foreground))]">
        id {u.id} ·{" "}
        <Link
          href={`/admin/conversations?user=${u.id}`}
          className="text-[hsl(var(--primary-ink))] hover:underline"
        >
          View conversations
        </Link>
      </p>

      {/* Red flags (trust & safety) */}
      {d.flags.length > 0 && (
        <section className="mb-6 rounded-xl border border-[hsl(var(--danger))]/40 bg-[hsl(var(--danger-soft))] p-4">
          <h2 className="mb-2 font-semibold text-[hsl(var(--danger))]">Red flags</h2>
          <ul className="space-y-1 text-sm text-[hsl(var(--danger))]">
            {d.flags.map((f) => (
              <li key={f.id}>
                <b>{f.severity}</b> · <span className="font-mono">{f.type}</span>
                {f.details ? (
                  <span className="ml-1 text-xs">{JSON.stringify(f.details)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Identity & activity */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Registered" value={dt(u.createdAt)} />
        <Stat label="Last login" value={dt(u.lastLoginAt)} />
        <Stat label="Last seen" value={dt(u.lastSeenAt)} />
        <Stat label="Last Telegram chat" value={dt(u.telegramLastChatAt)} />
      </section>

      <section className="mb-6 rounded-xl border border-[hsl(var(--border))] p-4 text-sm">
        <h2 className="mb-2 font-semibold">Identity</h2>
        <div className="grid gap-1 sm:grid-cols-2">
          <p>Email: <b>{u.email ?? "—"}</b></p>
          <p>Phone (KYC): <b className="font-mono">{u.phone ?? "—"}</b></p>
          <p>Telegram ID: <b className="font-mono">{u.telegramId ?? "—"}</b></p>
          <p>Payout card: <b className="font-mono">{u.payoutCardMasked ?? "—"}</b></p>
          <p>Locale: <b>{u.locale}</b></p>
          <p>Referrals brought: <b className="tabular-nums">{u.referrals}</b></p>
          <p>Credit balance: <b className="tabular-nums">{formatUzs(u.creditBalanceUzs)} so&apos;m</b></p>
        </div>
      </section>

      {/* Buyer side */}
      <section className="mb-6 rounded-xl border border-[hsl(var(--border))] p-4">
        <h2 className="mb-3 font-semibold">As buyer</h2>
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Paid (total)" value={`${formatUzs(d.buyer.paidUzs)} so'm`} />
          <Stat label="Payments made" value={d.buyer.paidCount} />
          <Stat label="Refunded" value={`${formatUzs(d.buyer.refundedUzs)} so'm (${d.buyer.refundedCount})`} />
          <Stat label="Sellers contacted" value={d.buyer.contactsStarted} />
          <Stat label="Reviews written" value={d.buyer.reviewsWritten} />
        </div>
        <p className="mb-1 text-xs text-[hsl(var(--muted-foreground))]">
          Last order: {dt(d.buyer.lastOrderAt)} · Last contact: {dt(d.buyer.lastContactAt)} · Messages sent (any side): {d.messagesSent}
        </p>
        <StatusRow map={d.buyer.ordersByStatus} />
      </section>

      {/* Seller side */}
      {d.seller && (
        <section className="mb-6 rounded-xl border border-[hsl(var(--border))] p-4">
          <h2 className="mb-3 font-semibold">As seller</h2>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Lifetime earned" value={`${formatUzs(d.seller.lifetimeEarnedUzs)} so'm`} />
            <Stat label="Withdrawable now" value={`${formatUzs(d.seller.availableUzs)} so'm`} />
            <Stat label="Paid out" value={`${formatUzs(d.seller.payoutsPaidUzs)} so'm (${d.seller.payoutsPaidCount})`} />
            <Stat label="Payouts pending" value={`${formatUzs(d.seller.payoutsPendingUzs)} so'm (${d.seller.payoutsPendingCount})`} />
          </div>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Gigs (active/total)" value={`${d.seller.gigsActive}/${d.seller.gigsTotal}`} />
            <Stat label="Rating" value={d.seller.profile ? `${d.seller.profile.ratingAvg.toFixed(1)} (${d.seller.profile.ratingCount})` : "—"} />
            <Stat label="Level" value={d.seller.profile?.level ?? "—"} />
            <Stat label="Buyer conversations" value={d.seller.conversations} />
          </div>
          {d.seller.profile?.instagramUsername && (
            <p className="mb-2 text-xs text-[hsl(var(--muted-foreground))]">
              Instagram: @{d.seller.profile.instagramUsername} (synced {dt(d.seller.profile.instagramSyncedAt)})
            </p>
          )}
          <StatusRow map={d.seller.ordersByStatus} />
        </section>
      )}

      {/* Their gigs — with moderation state visible at a glance. */}
      {d.gigsRecent.length > 0 && (
        <section className="mb-6 rounded-xl border border-[hsl(var(--border))] p-4">
          <h2 className="mb-2 font-semibold">Gigs ({d.gigsRecent.length} recent)</h2>
          <ul className="space-y-1 text-sm">
            {d.gigsRecent.map((g) => (
              <li key={g.id} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate">
                  <Link href={`/gigs/${g.slug}`} className="text-[hsl(var(--primary-ink))] hover:underline">
                    {g.title}
                  </Link>
                  <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">{g._count.orders} orders</span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    g.status === "ACTIVE"
                      ? "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]"
                      : g.status === "PENDING_REVIEW"
                        ? "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]"
                        : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                  }`}
                >
                  {g.status}
                </span>
              </li>
            ))}
          </ul>
          {d.gigsRecent.some((g) => g.status === "PENDING_REVIEW") && (
            <p className="mt-2 text-xs">
              <Link href="/admin/moderation" className="text-[hsl(var(--primary-ink))] hover:underline">
                → Review pending gigs in moderation
              </Link>
            </p>
          )}
        </section>
      )}

      {/* Recent orders, both sides — jump straight into any order page. */}
      {(d.ordersAsBuyer.length > 0 || d.ordersAsSeller.length > 0) && (
        <section className="mb-6 grid gap-4 sm:grid-cols-2">
          {[
            { title: "Recent orders (as buyer)", rows: d.ordersAsBuyer },
            { title: "Recent orders (as seller)", rows: d.ordersAsSeller },
          ].map(
            (col) =>
              col.rows.length > 0 && (
                <div key={col.title} className="rounded-xl border border-[hsl(var(--border))] p-4">
                  <h2 className="mb-2 font-semibold">{col.title}</h2>
                  <ul className="space-y-1 text-xs">
                    {col.rows.map((o) => (
                      <li key={o.id} className="flex items-baseline justify-between gap-2">
                        <Link href={`/orders/${o.id}`} className="min-w-0 truncate text-[hsl(var(--primary-ink))] hover:underline">
                          {o.gig.title}
                        </Link>
                        <span className="shrink-0 tabular-nums text-[hsl(var(--muted-foreground))]">
                          {formatUzs(o.amountUzs)} · {o.status} · {dt(o.createdAt).slice(0, 10)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
          )}
        </section>
      )}

      {/* Payout history */}
      {d.payoutsRecent.length > 0 && (
        <section className="mb-6 rounded-xl border border-[hsl(var(--border))] p-4">
          <h2 className="mb-2 font-semibold">Payout requests</h2>
          <ul className="space-y-1 text-xs">
            {d.payoutsRecent.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span className="tabular-nums">{formatUzs(p.amountUzs)} so&apos;m</span>
                <span className="text-[hsl(var(--muted-foreground))]">
                  {p.status} · {dt(p.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Management */}
      {u.role !== "ADMIN" && u.id !== admin.id && (
        <div className="mb-6">
          <AdminUserManage
            userId={u.id}
            status={u.status}
            isSeller={u.isSeller}
            sellerProfileId={d.seller?.profile?.id ?? null}
            approvalStatus={d.seller?.profile?.approvalStatus ?? null}
            creditBalanceUzs={u.creditBalanceUzs}
          />
        </div>
      )}

      {/* Activity — tracked events and the user's own audited actions, one feed,
          newest first, in plain words (the LMS-style timeline). */}
      <section className="rounded-xl border border-[hsl(var(--border))] p-4">
        <h2 className="mb-2 font-semibold">Activity</h2>
        {(() => {
          const feed = [
            ...d.recentEvents.map((e) => ({ label: readable(e.type), raw: e.type, at: e.createdAt })),
            ...d.recentAudit.map((a) => ({ label: readable(a.action), raw: a.action, at: a.createdAt })),
          ]
            .sort((a, b) => +new Date(b.at) - +new Date(a.at))
            .slice(0, 30);
          if (feed.length === 0)
            return <p className="text-sm text-[hsl(var(--muted-foreground))]">No activity yet.</p>;
          return (
            <ul className="space-y-1.5 text-sm">
              {feed.map((f, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3">
                  <span>
                    {f.label}
                    {f.label !== f.raw && (
                      <span className="ml-2 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{f.raw}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">{dt(f.at)}</span>
                </li>
              ))}
            </ul>
          );
        })()}
      </section>
    </div>
  );
}
