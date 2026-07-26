"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export interface AdminUserRow {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  role: string;
  isSeller: boolean;
  approvalStatus: string | null;
  status: string;
  kycStatus: string;
  orders: number;
  sales: number;
  flags: number;
  createdAt: string; // ISO (server-serialized)
  lastSeenAt: string | null;
}

type Bulk = "suspend" | "unsuspend" | "makeSeller" | "removeSeller" | "creditGrant";

/** Compact "how long ago". */
function ago(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / (24 * 60))}d`;
}

/**
 * The admin user table with multi-select. Selection lives here (client) while the
 * page stays a server component for filtering/paging. Bulk actions route through
 * /api/admin/users/bulk, which applies the same per-user guards, audit rows, and
 * notifications as acting one-by-one. Admins/self are skipped server-side, so
 * "select all" is always safe to click.
 */
export function AdminUsersTable({ rows }: { rows: AdminUserRow[] }) {
  const t = useTranslations("AdminUsers");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<Bulk | null>(null);

  const selectable = rows.filter((r) => r.role !== "ADMIN");
  const allSelected = selectable.length > 0 && selectable.every((r) => sel.has(r.id));

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSel(allSelected ? new Set() : new Set(selectable.map((r) => r.id)));

  async function run(action: Bulk) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          userIds: [...sel],
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          ...(action === "creditGrant" && amount ? { amountUzs: parseInt(amount, 10) } : {}),
        }),
      });
      const j = await r.json();
      if (!j.ok) {
        setMsg(j.error?.message ?? "Failed");
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch {
      setMsg("Network error");
      setBusy(false);
    }
  }

  /** Export exactly the selected rows — no server round-trip needed. */
  function exportSelected() {
    const head = ["id", "name", "username", "email", "role", "seller", "kyc", "status", "orders", "sales", "flags", "joined"];
    const esc = (v: string | number | null) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [head.join(",")];
    for (const r of rows.filter((x) => sel.has(x.id))) {
      lines.push(
        [r.id, r.name, r.username, r.email, r.role, r.isSeller ? "yes" : "no", r.kycStatus, r.status, r.orders, r.sales, r.flags, r.createdAt.slice(0, 10)]
          .map(esc)
          .join(",")
      );
    }
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `gigora-selected-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const btn =
    "rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-1 text-xs font-medium hover:bg-[hsl(var(--muted))] disabled:opacity-50";
  const input = "h-8 rounded-md border border-[hsl(var(--input-border))] bg-[hsl(var(--card))] px-2 text-xs";

  return (
    <>
      {/* Sticky bulk bar — only present when something is selected. */}
      {sel.size > 0 && (
        <div className="sticky top-16 z-30 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/8 p-2.5 shadow-[var(--shadow-soft)]">
          <span className="text-sm font-bold">{t("selected", { n: sel.size })}</span>
          <button type="button" className={btn} onClick={() => setSel(new Set())}>
            {t("clearSel")}
          </button>
          <span className="mx-1 h-4 w-px bg-[hsl(var(--border))]" />
          <button type="button" className={btn} onClick={exportSelected}>
            ⬇ CSV
          </button>
          <button type="button" className={btn} disabled={busy} onClick={() => setMode(mode === "suspend" ? null : "suspend")}>
            {t("suspend")}…
          </button>
          <button type="button" className={btn} disabled={busy} onClick={() => run("unsuspend")}>
            {t("unsuspend")}
          </button>
          <button type="button" className={btn} disabled={busy} onClick={() => run("makeSeller")}>
            {t("makeSeller")}
          </button>
          <button type="button" className={btn} disabled={busy} onClick={() => run("removeSeller")}>
            {t("removeSeller")}
          </button>
          <button type="button" className={btn} disabled={busy} onClick={() => setMode(mode === "creditGrant" ? null : "creditGrant")}>
            🎁 {t("bulkCredit")}…
          </button>

          {/* Reason / amount inputs appear for the actions that require them. */}
          {mode === "suspend" && (
            <span className="flex w-full items-center gap-2">
              <input
                className={`${input} flex-1`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("bulkReasonPh")}
                aria-label={t("bulkReasonPh")}
                maxLength={500}
              />
              <button type="button" className={btn} disabled={busy || reason.trim().length < 3} onClick={() => run("suspend")}>
                {busy ? "…" : `${t("suspend")} ${sel.size}`}
              </button>
            </span>
          )}
          {mode === "creditGrant" && (
            <span className="flex w-full items-center gap-2">
              <input
                className={`${input} w-28`}
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="so'm"
                aria-label={t("bulkCredit")}
              />
              <input
                className={`${input} flex-1`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("bulkReasonPh")}
                aria-label={t("bulkReasonPh")}
                maxLength={500}
              />
              <button
                type="button"
                className={btn}
                disabled={busy || !amount || reason.trim().length < 3}
                onClick={() => run("creditGrant")}
              >
                {busy ? "…" : `${t("bulkGrant")} ${sel.size}`}
              </button>
            </span>
          )}
          {msg && <span className="w-full text-xs text-[hsl(var(--danger))]">{msg}</span>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--border))] text-left text-xs text-[hsl(var(--muted-foreground))]">
              <th className="w-8 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label={t("selectAll")}
                />
              </th>
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
            {rows.map((u) => (
              <tr
                key={u.id}
                className={`border-b border-[hsl(var(--border))] ${sel.has(u.id) ? "bg-[hsl(var(--primary))]/5" : ""}`}
              >
                <td className="py-2">
                  {u.role !== "ADMIN" && (
                    <input
                      type="checkbox"
                      checked={sel.has(u.id)}
                      onChange={() => toggle(u.id)}
                      aria-label={`${t("select")} ${u.name}`}
                    />
                  )}
                </td>
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
                <td className="text-xs tabular-nums">{u.createdAt.slice(0, 10)}</td>
                <td className="text-xs">{ago(u.lastSeenAt)}</td>
                <td>
                  <span className="flex items-center gap-3 whitespace-nowrap text-xs">
                    <Link href={`/admin/users/${u.id}`} className="text-[hsl(var(--primary-ink))] hover:underline">
                      📊 {t("statistics")}
                    </Link>
                    <Link href={`/admin/users/${u.id}?tab=manage`} className="text-[hsl(var(--primary-ink))] hover:underline">
                      {t("manage")}
                    </Link>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
