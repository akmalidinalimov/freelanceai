import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AdminUsersTable } from "@/components/admin-users-table";
import { requireAdminUser } from "@/lib/auth-guards";
import {
  listUsersForAdmin,
  type AdminKycFilter,
  type AdminUserSegment,
} from "@/server/services/admin-users";

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
        <AdminUsersTable
          rows={users.map((u) => ({
            id: u.id,
            name: u.name,
            username: u.username,
            email: u.email,
            role: u.role,
            isSeller: u.isSeller,
            approvalStatus: u.approvalStatus,
            status: u.status,
            kycStatus: u.kycStatus,
            isCourseStudent: u.isCourseStudent,
            orders: u.orders,
            sales: u.sales,
            flags: u.flags,
            createdAt: u.createdAt.toISOString(),
            lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
          }))}
        />
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
