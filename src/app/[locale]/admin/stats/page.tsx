import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdminUser } from "@/lib/auth-guards";
import { getAdminInfographics } from "@/server/services/analytics";
import { formatUzs } from "@/lib/utils";

export const dynamic = "force-dynamic";

const nf = (n: number) => n.toLocaleString("ru-RU");

/** A headline metric card with an optional sub-line. */
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{sub}</p>}
    </div>
  );
}

/** Simple vertical bars for a handful of labelled values (e.g. signup windows). */
function Bars({ title, data }: { title: string; data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <figure className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <figcaption className="mb-4 text-sm font-semibold">{title}</figcaption>
      <div
        role="img"
        aria-label={`${title}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}
        className="flex items-end justify-between gap-3"
        style={{ height: 140 }}
      >
        {data.map((d) => (
          <div key={d.label} className="flex flex-1 flex-col items-center justify-end gap-2">
            <span className="text-sm font-bold tabular-nums text-[hsl(var(--primary-ink))]">{nf(d.value)}</span>
            <div
              className="w-full rounded-t-md bg-[hsl(var(--primary))]"
              style={{ height: `${Math.max(4, (d.value / max) * 96)}px` }}
            />
            <span className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{d.label}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

/** Server-rendered area+line SVG trend for a 14-day daily series. */
function Trend({ title, series }: { title: string; series: { day: string; n: number }[] }) {
  if (series.length === 0) {
    return (
      <figure className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <figcaption className="mb-3 text-sm font-semibold">{title}</figcaption>
        <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">No data yet</p>
      </figure>
    );
  }
  const W = 680;
  const H = 160;
  const P = 8;
  const innerW = W - P * 2;
  const innerH = H - P * 2;
  const max = Math.max(...series.map((s) => s.n), 1);
  const total = series.reduce((a, s) => a + s.n, 0);
  const x = (i: number) => P + (series.length <= 1 ? 0 : (i / (series.length - 1)) * innerW);
  const y = (n: number) => P + innerH - (n / max) * innerH;
  const pts = series.map((s, i) => `${x(i).toFixed(1)},${y(s.n).toFixed(1)}`);
  const line = `M ${pts.join(" L ")}`;
  const area = `M ${x(0).toFixed(1)},${(H - P).toFixed(1)} L ${pts.join(" L ")} L ${x(series.length - 1).toFixed(1)},${(H - P).toFixed(1)} Z`;
  const last = series[series.length - 1];
  return (
    <figure className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <figcaption className="mb-3 flex items-baseline justify-between">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {nf(total)} total · last 14 days
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-40 w-full"
        role="img"
        aria-label={`${title} over the last 14 days, ${nf(total)} total, peak ${nf(max)} per day`}
        preserveAspectRatio="none"
      >
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={P}
            x2={W - P}
            y1={P + innerH * g}
            y2={P + innerH * g}
            stroke="hsl(var(--border))"
            strokeWidth={1}
          />
        ))}
        <path d={area} fill="hsl(var(--primary))" fillOpacity={0.12} />
        <path d={line} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {last && <circle cx={x(series.length - 1)} cy={y(last.n)} r={3.5} fill="hsl(var(--primary))" />}
      </svg>
    </figure>
  );
}

export default async function AdminStatsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminUser(locale);
  const s = await getAdminInfographics();

  const completionRate = s.totalOrders > 0 ? Math.round((s.completedOrders / s.totalOrders) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Statistics</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Live platform overview</p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-[hsl(var(--primary-ink))] hover:underline">
          ← Admin console
        </Link>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Users" value={nf(s.users)} sub={`${nf(s.buyers)} buyers · ${nf(s.sellers)} sellers`} />
        <Stat label="Sellers" value={nf(s.sellers)} />
        <Stat label="Active gigs" value={nf(s.activeGigs)} />
        <Stat label="Orders placed" value={nf(s.totalOrders)} />
        <Stat label="Orders completed" value={nf(s.completedOrders)} sub={`${completionRate}% completion`} />
        <Stat label="New signups (24h)" value={nf(s.signups.d1)} />
        <Stat label="GMV" value={`${formatUzs(s.gmvUzs)} so'm`} />
        <Stat label="Platform revenue" value={`${formatUzs(s.platformRevenueUzs)} so'm`} />
      </div>

      {/* Signups over rolling windows */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Bars
          title="New signups"
          data={[
            { label: "24h", value: s.signups.d1 },
            { label: "3d", value: s.signups.d3 },
            { label: "7d", value: s.signups.d7 },
            { label: "30d", value: s.signups.d30 },
          ]}
        />
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Buyers" value={nf(s.buyers)} />
          <Stat label="Sellers" value={nf(s.sellers)} />
          <Stat label="Completion rate" value={`${completionRate}%`} />
          <Stat label="Signups (7d)" value={nf(s.signups.d7)} />
        </div>
      </div>

      {/* Daily trends */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Trend title="Daily signups" series={s.dailySignups} />
        <Trend title="Daily orders" series={s.dailyOrders} />
      </div>
    </div>
  );
}
