"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Admin management panel on the user-detail page: suspend/reactivate, seller toggle,
 * and irreversible delete (typed confirmation). ADMIN role is deliberately NOT
 * manageable here — it's allowlist-only via ADMIN_TELEGRAM_IDS.
 */
export function AdminUserManage({
  userId,
  status,
  isSeller,
}: {
  userId: string;
  status: string;
  isSeller: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [showDelete, setShowDelete] = useState(false);

  async function act(action: string, extra?: Record<string, string>) {
    setBusy(action);
    setError(null);
    try {
      const r = await fetch(`/api/admin/users/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const j = await r.json();
      if (!j.ok) {
        setError(j.error?.message ?? "Action failed");
        setBusy(null);
        return;
      }
      if (action === "delete") {
        window.location.href = "../users";
        return;
      }
      router.refresh();
      setBusy(null);
    } catch {
      setError("Network error");
      setBusy(null);
    }
  }

  const btn =
    "rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm font-medium hover:bg-[hsl(var(--muted))] disabled:opacity-50";

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-4">
      <h2 className="mb-3 font-semibold">Manage</h2>
      <div className="flex flex-wrap gap-2">
        {status === "ACTIVE" ? (
          <button className={btn} disabled={!!busy} onClick={() => act("suspend")}>
            {busy === "suspend" ? "…" : "Suspend"}
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
          className={`${btn} border-red-300 text-red-700`}
          disabled={!!busy}
          onClick={() => setShowDelete((s) => !s)}
        >
          Delete account…
        </button>
      </div>

      {showDelete && (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm dark:bg-red-950/20">
          <p className="mb-2">
            Irreversible: anonymizes the account (orders/ledger kept as anonymous records),
            deletes portfolio media, revokes Instagram, kills sessions. Blocked while the
            user has active orders or a withdrawable balance. Type <b>DELETE</b> to confirm.
          </p>
          <div className="flex gap-2">
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              aria-label='Type DELETE to confirm'
              className="h-9 flex-1 rounded-md border border-[hsl(var(--input-border))] bg-transparent px-2"
            />
            <button
              className={`${btn} border-red-400 bg-red-600 text-white hover:bg-red-700`}
              disabled={confirmText !== "DELETE" || !!busy}
              onClick={() => act("delete", { confirm: confirmText })}
            >
              {busy === "delete" ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
      <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
        Admin role cannot be granted here — it is allowlist-only (ADMIN_TELEGRAM_IDS), by design.
      </p>
    </div>
  );
}
