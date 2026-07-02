import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireAdminUser } from "@/lib/auth-guards";
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
  const d = await getUserDetailForAdmin(admin, id).catch(() => null);
  if (!d) notFound();
  const u = d.identity;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="mb-2 text-sm">
        <Link href="/admin/users" className="text-[hsl(var(--primary))] hover:underline">
          ← All users
        </Link>
      </p>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{u.name || "(no name)"}</h1>
        {u.username && <span className="text-[hsl(var(--muted-foreground))]">@{u.username}</span>}
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
          {u.status}
        </span>
        <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs font-semibold">
          {u.role === "ADMIN" ? "ADMIN" : u.isSeller ? "SELLER" : "BUYER"}
        </span>
        <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">KYC: {u.kycStatus}</span>
      </div>
      <p className="mb-6 text-xs text-[hsl(var(--muted-foreground))]">id {u.id}</p>

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
        </div>
      </section>

      {/* Buyer side */}
      <section className="mb-6 rounded-xl border border-[hsl(var(--border))] p-4">
        <h2 className="mb-3 font-semibold">As buyer</h2>
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Paid (total)" value={`${formatUzs(d.buyer.paidUzs)} so'm`} />
          <Stat label="Payments made" value={d.buyer.paidCount} />
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

      {/* Management */}
      {u.role !== "ADMIN" && u.id !== admin.id && (
        <div className="mb-6">
          <AdminUserManage userId={u.id} status={u.status} isSeller={u.isSeller} />
        </div>
      )}

      {/* Recent activity */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[hsl(var(--border))] p-4">
          <h2 className="mb-2 font-semibold">Recent events</h2>
          {d.recentEvents.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No tracked events yet.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {d.recentEvents.map((e, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="font-mono">{e.type}</span>
                  <span className="text-[hsl(var(--muted-foreground))]">{dt(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-[hsl(var(--border))] p-4">
          <h2 className="mb-2 font-semibold">Recent actions (audit)</h2>
          {d.recentAudit.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No audit entries.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {d.recentAudit.map((a, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="font-mono">{a.action}</span>
                  <span className="text-[hsl(var(--muted-foreground))]">{dt(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
