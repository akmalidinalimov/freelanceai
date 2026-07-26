"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Admin management panel on the user-detail page: suspend (with an audited reason),
 * seller approval (approve / reject with reason), seller toggle, credit adjustment
 * (support compensations — audited, balance can't go negative), and irreversible
 * delete (typed confirmation). ADMIN role is deliberately NOT manageable here —
 * it's allowlist-only via ADMIN_TELEGRAM_IDS.
 */
export function AdminUserManage({
  userId,
  status,
  isSeller,
  sellerProfileId,
  approvalStatus,
  creditBalanceUzs,
}: {
  userId: string;
  status: string;
  isSeller: boolean;
  sellerProfileId?: string | null;
  approvalStatus?: string | null;
  creditBalanceUzs: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [showSuspend, setShowSuspend] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");

  async function post(url: string, body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j.ok) {
        setError(j.error?.message ?? "Action failed");
        setBusy(null);
        return false;
      }
      router.refresh();
      setBusy(null);
      return true;
    } catch {
      setError("Network error");
      setBusy(null);
      return false;
    }
  }

  const act = (action: string, extra?: Record<string, unknown>) =>
    post(`/api/admin/users/${userId}`, { action, ...extra }, action);

  const btn =
    "rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm font-medium hover:bg-[hsl(var(--muted))] disabled:opacity-50";
  const input = "h-9 rounded-md border border-[hsl(var(--input-border))] bg-transparent px-2 text-sm";

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-4">
      <h2 className="mb-3 font-semibold">Manage</h2>

      {/* Seller approval — the storefront gate, right where the evidence is. */}
      {isSeller && sellerProfileId && (approvalStatus === "PENDING" || approvalStatus === "REJECTED") && (
        <div className="mb-4 rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/8 p-3">
          <p className="mb-2 text-sm font-semibold">
            Seller approval: <span className="font-mono">{approvalStatus}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`${btn} border-[hsl(var(--success))]/50 text-[hsl(var(--success))]`}
              disabled={!!busy}
              onClick={() => post("/api/admin/sellers", { action: "approve", profileId: sellerProfileId }, "approve")}
            >
              {busy === "approve" ? "…" : "✓ Approve seller"}
            </button>
            <button className={btn} disabled={!!busy} onClick={() => setShowReject((s) => !s)}>
              Reject…
            </button>
          </div>
          {showReject && (
            <div className="mt-2 flex gap-2">
              <input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Rejection reason (shown to the seller)"
                aria-label="Rejection reason"
                className={`${input} flex-1`}
                maxLength={500}
              />
              <button
                className={`${btn} text-[hsl(var(--danger))]`}
                disabled={!rejectReason.trim() || !!busy}
                onClick={() =>
                  post("/api/admin/sellers", { action: "reject", profileId: sellerProfileId, reason: rejectReason.trim() }, "reject")
                }
              >
                {busy === "reject" ? "…" : "Reject"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {status === "ACTIVE" ? (
          <button className={btn} disabled={!!busy} onClick={() => setShowSuspend((s) => !s)}>
            Suspend…
          </button>
        ) : (
          <button className={btn} disabled={!!busy} onClick={() => act("unsuspend")}>
            {busy === "unsuspend" ? "…" : "Reactivate"}
          </button>
        )}
        {isSeller ? (
          <button className={btn} disabled={!!busy} onClick={() => act("removeSeller")}>
            {busy === "removeSeller" ? "…" : "Remove seller role"}
          </button>
        ) : (
          <button className={btn} disabled={!!busy} onClick={() => act("makeSeller")}>
            {busy === "makeSeller" ? "…" : "Make seller"}
          </button>
        )}
        <button
          className={btn}
          disabled={!!busy}
          onClick={async () => {
            // "Log in as": signed 30-min overlay cookie; the admin session stays intact.
            if (await post("/api/admin/impersonate", { userId }, "impersonate")) {
              window.location.href = "/";
            }
          }}
        >
          {busy === "impersonate" ? "…" : "👁 Log in as"}
        </button>
        <button
          className={`${btn} border-[hsl(var(--danger))]/40 text-[hsl(var(--danger))]`}
          disabled={!!busy}
          onClick={() => setShowDelete((s) => !s)}
        >
          Delete account…
        </button>
      </div>

      {/* Suspend with an audited reason — it also rides the user's suspension notice. */}
      {showSuspend && status === "ACTIVE" && (
        <div className="mt-3 flex gap-2">
          <input
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="Reason (optional — audited + sent to the user)"
            aria-label="Suspension reason"
            className={`${input} flex-1`}
            maxLength={500}
          />
          <button
            className={`${btn} text-[hsl(var(--danger))]`}
            disabled={!!busy}
            onClick={() => act("suspend", suspendReason.trim() ? { reason: suspendReason.trim() } : {})}
          >
            {busy === "suspend" ? "…" : "Suspend now"}
          </button>
        </div>
      )}

      {/* Credit adjustment — the support-compensation lever. Audited with reason. */}
      <div className="mt-4 rounded-lg border border-[hsl(var(--border))] p-3">
        <p className="mb-2 text-sm font-semibold">
          Credit balance: <span className="tabular-nums">{creditBalanceUzs.toLocaleString()} so&apos;m</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={creditAmount}
            onChange={(e) => setCreditAmount(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder="Amount (so'm)"
            aria-label="Credit amount (so'm)"
            className={`${input} w-32`}
          />
          <input
            value={creditReason}
            onChange={(e) => setCreditReason(e.target.value)}
            placeholder="Reason (required, audited)"
            aria-label="Credit adjustment reason"
            className={`${input} min-w-44 flex-1`}
            maxLength={300}
          />
          <button
            className={`${btn} border-[hsl(var(--success))]/50 text-[hsl(var(--success))]`}
            disabled={!!busy || !creditAmount || creditReason.trim().length < 3}
            onClick={() => act("creditAdjust", { amountUzs: parseInt(creditAmount, 10), reason: creditReason.trim() })}
          >
            {busy === "creditAdjust" ? "…" : "+ Grant"}
          </button>
          <button
            className={btn}
            disabled={!!busy || !creditAmount || creditReason.trim().length < 3}
            onClick={() => act("creditAdjust", { amountUzs: -parseInt(creditAmount, 10), reason: creditReason.trim() })}
          >
            − Deduct
          </button>
        </div>
      </div>

      {showDelete && (
        <div className="mt-3 rounded-lg border border-[hsl(var(--danger))]/40 bg-[hsl(var(--danger-soft))] p-3 text-sm">
          <p className="mb-2">
            Irreversible: anonymizes the account (orders/ledger kept as anonymous records),
            deletes portfolio media, revokes Instagram, kills sessions. Blocked while the
            user has active orders or a withdrawable balance. Type <b>DELETE</b> to confirm.
          </p>
          <div className="flex gap-2">
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              aria-label="Type DELETE to confirm"
              className={`${input} flex-1`}
            />
            <button
              className={`${btn} border-[hsl(var(--danger))]/50 bg-[hsl(var(--danger))] text-white hover:opacity-90`}
              disabled={confirmText !== "DELETE" || !!busy}
              onClick={async () => {
                if (await post(`/api/admin/users/${userId}`, { action: "delete", confirm: confirmText }, "delete")) {
                  window.location.href = "../users";
                }
              }}
            >
              {busy === "delete" ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-[hsl(var(--danger))]">{error}</p>}
      <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
        Admin role cannot be granted here — it is allowlist-only (ADMIN_TELEGRAM_IDS), by design.
      </p>
    </div>
  );
}
