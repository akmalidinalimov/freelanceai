import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdminUser } from "@/lib/auth-guards";
import {
  listUsersForAdmin,
  type AdminKycFilter,
  type AdminUserSegment,
} from "@/server/services/admin-users";
import { UserRowActions } from "@/components/user-row-actions";

/** Compact "how long ago" for activity columns (admin-only page — English is fine). */
function ago(d: Date | null): string {
  if (!d) return "—";
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / (24 * 60))}d`;
}

const day = (d: Date) => new Date(d).toISOString().slice(0, 10);

const SEGMENTS = ["all", "buyers", "sellers", "pending", "suspended"] as const;
const KYC_OPTIONS = ["", "NONE", "PENDING", "VERIFIED", "REJECTED"] as const;

/** Build a query string preserving the current filter (used by tabs, pager, export). */
function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== "all" && !(k === "page" && v === 1)) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; segment?: string; kyc?: string; flagged?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminUser(locale);
  const sp = await searchParams;
  const t = await getTranslations("AdminUsers");

  const segment = (SEGMENTS as readonly string[]).includes(sp.segment ?? "")
    ? (sp.segment as AdminUserSegment)
    : "all";
  const kyc = (KYC_OPTIONS as readonly string[]).includes(sp.kyc ?? "") && sp.kyc ? (sp.kyc as AdminKycFilter) : undefined;
  const flagged = sp.flagged === "1";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const filter = { q: sp.q, segment, kyc, flagged, page };

  const { users, total, pages, counts } = await listUsersForAdmin(filter);

  const TAB_LABEL: Record<AdminUserSegment, string> = {
    all: "All",
    buyers: "Buyers",
    sellers: "Sellers",
    pending: "⏳ Pending approval",
    suspended: "Suspended",
  };
  const TAB_COUNT: Record<AdminUserSegment, number> = {
    all: counts.all,
    buyers: counts.buyers,
    sellers: counts.sellers,
    pending: counts.pending,
    suspended: counts.suspended,
  };

  const field = "h-10 rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 text-sm";
  const exportHref = `/api/admin/users/export${qs({ q: sp.q, segment, kyc, flagged: flagged ? 1 : undefined })}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {/* Plain <a>: a route handler download, not a client navigation. */}
        <a
          href={exportHref}
          className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm font-medium hover:bg-[hsl(var(--muted))]"
        >
          ⬇ Export CSV
        </a>
      </div>
      <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
        {counts.all} users · {counts.sellers} sellers · {counts.pending} awaiting approval · {counts.suspended} suspended
      </p>

      {/* Segment tabs with live counts — pending approval is the daily work queue. */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {SEGMENTS.map((s) => (
          <Link
            key={s}
            href={`/admin/users${qs({ q: sp.q, segment: s, kyc, flagged: flagged ? 1 : undefined })}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              s === segment
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]"
            } ${s === "pending" && counts.pending > 0 && s !== segment ? "border-[hsl(var(--warning))] text-[hsl(var(--foreground))]" : ""}`}
          >
            {TAB_LABEL[s]} ({TAB_COUNT[s]})
          </Link>
        ))}
      </div>

      <form method="get" className="mb-6 flex flex-wrap items-center gap-2">
        {segment !== "all" && <input type="hidden" name="segment" value={segment} />}
        <input name="q" defaultValue={sp.q ?? ""} placeholder={t("searchPh")} className={`${field} min-w-56 flex-1`} />
        <select name="kyc" defaultValue={kyc ?? ""} className={field} aria-label="KYC filter">
          <option value="">KYC: any</option>
          {KYC_OPTIONS.filter(Boolean).map((k) => (
            <option key={k} value={k}>KYC: {k}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="flagged" value="1" defaultChecked={flagged} />
          🚩 flagged only
        </label>
        <button
          type="submit"
          className="h-10 rounded-md bg-[hsl(var(--primary))] px-5 text-sm font-medium text-[hsl(var(--primary-foreground))]"
        >
          {t("search")}
        </button>
      </form>

      {users.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("none")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] text-left text-xs text-[hsl(var(--muted-foreground))]">
                <th className="py-2">{t("user")}</th>
                <th>{t("role")}</th>
                <th>KYC</th>
                <th>{t("status")}</th>
                <th className="tabular-nums">{t("orders")}</th>
                <th className="tabular-nums">{t("sales")}</th>
                <th className="tabular-nums">🚩</th>
                <th>Joined</th>
                <th>Seen</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[hsl(var(--border))]">
                  <td className="max-w-56 py-2">
                    <Link href={`/admin/users/${u.id}`} className="font-medium text-[hsl(var(--primary-ink))] hover:underline">
                      {u.name || "(no name)"}
                    </Link>
                    <span className="block truncate text-xs text-[hsl(var(--muted-foreground))]">
                      {u.username && `@${u.username}`} {u.email && `· ${u.email}`}
                    </span>
                  </td>
                  <td>
                    {u.role === "ADMIN" ? (
                      "ADMIN"
                    ) : u.isSeller ? (
                      <span>
                        {t("seller")}
                        {u.approvalStatus && u.approvalStatus !== "APPROVED" && (
                          <span
                            className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              u.approvalStatus === "PENDING"
                                ? "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]"
                                : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                            }`}
                          >
                            {u.approvalStatus}
                          </span>
                        )}
                      </span>
                    ) : (
                      t("buyer")
                    )}
                  </td>
                  <td className="text-xs">{u.kycStatus === "NONE" ? "—" : u.kycStatus}</td>
                  <td>
                    <span className={u.status === "ACTIVE" ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--danger))]"}>
                      {u.status}
                    </span>
                  </td>
                  <td className="tabular-nums">{u.orders}</td>
                  <td className="tabular-nums">{u.sales}</td>
                  <td className="tabular-nums">
                    {u.flags > 0 ? <span className="font-bold text-[hsl(var(--danger))]">{u.flags}</span> : "—"}
                  </td>
                  <td className="text-xs tabular-nums">{day(u.createdAt)}</td>
                  <td className="text-xs">{ago(u.lastSeenAt)}</td>
                  <td>
                    {u.role === "ADMIN" ? (
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                    ) : (
                      <UserRowActions userId={u.id} status={u.status} isSeller={u.isSeller} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pager */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-[hsl(var(--muted-foreground))]">
            Page {page} of {pages} · {total} matching
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/users${qs({ q: sp.q, segment, kyc, flagged: flagged ? 1 : undefined, page: page - 1 })}`}
                className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 hover:bg-[hsl(var(--muted))]"
              >
                ← Prev
              </Link>
            )}
            {page < pages && (
              <Link
                href={`/admin/users${qs({ q: sp.q, segment, kyc, flagged: flagged ? 1 : undefined, page: page + 1 })}`}
                className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 hover:bg-[hsl(var(--muted))]"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
