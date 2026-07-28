"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { GalleryUpload } from "@/components/gallery-upload";
import { useConfirm } from "@/components/confirm-dialog";

type Status =
  | "IN_PROGRESS"
  | "DELIVERED"
  | "REVISION"
  | "COMPLETED"
  | "CANCELLED"
  | "PENDING_PAYMENT"
  | "PAID"
  | "DISPUTED";
type Role = "buyer" | "seller" | "admin";

/** Role + status-aware order actions. The server enforces all transitions. */
export function OrderActions({
  orderId,
  status,
  role,
  checkoutUrl,
  autoCompleteAt,
}: {
  orderId: string;
  status: Status;
  role: Role;
  checkoutUrl?: string | null;
  /** ISO date when a DELIVERED order auto-accepts — shown so escrow release never surprises. */
  autoCompleteAt?: string | null;
}) {
  const t = useTranslations("Order");
  const format = useFormatter();
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function act(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const j = await r.json();
      if (j.ok) {
        // Reorder returns a fresh order id → navigate to it; otherwise refresh in place.
        if (j.data?.orderId) router.push(`/orders/${j.data.orderId}`);
        else window.location.reload();
      } else {
        setError(j.error?.message ?? t("error"));
        setBusy(false);
      }
    } catch {
      setError(t("error"));
      setBusy(false);
    }
  }

  const isSeller = role === "seller" || role === "admin";
  const isBuyer = role === "buyer" || role === "admin";
  const isAdmin = role === "admin";
  const active = status === "IN_PROGRESS" || status === "REVISION";
  // Direct cancel is only for an unpaid order. Paid (active) orders cancel via the mutual
  // cancellation request (CancellationBox), which reverses the ledger + refunds the buyer.
  const cancelable = status === "PENDING_PAYMENT";

  return (
    <div className="space-y-3">
      {isBuyer && status === "COMPLETED" && (
        <Button variant="outline" onClick={() => act("reorder")} disabled={busy}>
          {t("reorder")}
        </Button>
      )}
      {status === "PENDING_PAYMENT" &&
        (isAdmin ? (
          <div className="space-y-2 rounded-xl border border-[hsl(var(--border))] p-4">
            <p className="text-sm font-medium">{t("confirmPaymentTitle")}</p>
            <Button onClick={() => act("confirm_payment")} disabled={busy} variant="accent">
              {t("confirmPayment")}
            </Button>
          </div>
        ) : checkoutUrl ? (
          <div className="space-y-2 rounded-xl border border-[hsl(var(--border))] p-4">
            <p className="text-sm font-medium">{t("payTitle")}</p>
            <a href={checkoutUrl}>
              <Button variant="accent" className="w-full">
                {t("payNow")}
              </Button>
            </a>
          </div>
        ) : (
          <p className="rounded-xl border border-[hsl(var(--border))] p-4 text-sm text-[hsl(var(--muted-foreground))]">
            {t("awaitingPayment")}
          </p>
        ))}

      {isSeller && active && (
        <div className="space-y-2 rounded-xl border border-[hsl(var(--border))] p-4">
          <p className="text-sm font-medium">{t("deliverTitle")}</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("deliverPh")}
            aria-label={t("deliverPh")}
            className="min-h-20 w-full rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 py-2 text-sm"
          />
          <GalleryUpload value={files} onChange={setFiles} prefix="deliveries" label={t("deliverFiles")} video />
          <Button onClick={() => act("deliver", { message, fileUrls: files })} disabled={busy}>
            {t("deliver")}
          </Button>
        </div>
      )}

      {isBuyer && status === "DELIVERED" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={async () => {
                // Accepting releases the held payment and is irreversible — confirm first.
                if (await confirm({ title: t("acceptConfirmTitle"), message: t("acceptConfirmBody"), confirmLabel: t("accept") })) {
                  act("accept");
                }
              }}
              disabled={busy}
              variant="accent"
            >
              {t("accept")}
            </Button>
            <Button
              onClick={() => setRevisionOpen((v) => !v)}
              disabled={busy}
              variant="outline"
              aria-expanded={revisionOpen}
            >
              {t("requestRevision")}
            </Button>
          </div>
          {/* A revision needs a reason — the note lands in the order chat, so the seller
              knows exactly what to change without a "what should I fix?" round-trip. */}
          {revisionOpen && (
            <div className="space-y-2 rounded-xl border border-[hsl(var(--border))] p-4">
              <p className="text-sm font-medium">{t("revisionTitle")}</p>
              <textarea
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                placeholder={t("revisionPh")}
                aria-label={t("revisionTitle")}
                maxLength={1000}
                className="min-h-20 w-full rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 py-2 text-sm"
              />
              <Button
                onClick={() => act("revision", { message: revisionNote.trim() })}
                disabled={busy || !revisionNote.trim()}
              >
                {t("revisionSend")}
              </Button>
            </div>
          )}
          {autoCompleteAt && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("autoAcceptNote", {
                date: format.dateTime(new Date(autoCompleteAt), { day: "numeric", month: "long" }),
              })}
            </p>
          )}
        </div>
      )}

      {cancelable && (
        <Button onClick={() => act("cancel")} disabled={busy} variant="ghost" size="sm">
          {t("cancel")}
        </Button>
      )}

      {error && <p className="text-sm text-[hsl(var(--danger))]">{error}</p>}
    </div>
  );
}
