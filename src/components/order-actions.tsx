"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { GalleryUpload } from "@/components/gallery-upload";

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
export function OrderActions({ orderId, status, role }: { orderId: string; status: Status; role: Role }) {
  const t = useTranslations("Order");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<string[]>([]);
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
      if (j.ok) window.location.reload();
      else {
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
  const cancelable = active || status === "PENDING_PAYMENT";

  return (
    <div className="space-y-3">
      {status === "PENDING_PAYMENT" &&
        (isAdmin ? (
          <div className="space-y-2 rounded-xl border border-[hsl(var(--border))] p-4">
            <p className="text-sm font-medium">{t("confirmPaymentTitle")}</p>
            <Button onClick={() => act("confirm_payment")} disabled={busy} variant="accent">
              {t("confirmPayment")}
            </Button>
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
            className="min-h-20 w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
          />
          <GalleryUpload value={files} onChange={setFiles} prefix="deliveries" label={t("deliverFiles")} video />
          <Button onClick={() => act("deliver", { message, fileUrls: files })} disabled={busy}>
            {t("deliver")}
          </Button>
        </div>
      )}

      {isBuyer && status === "DELIVERED" && (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => act("accept")} disabled={busy} variant="accent">
            {t("accept")}
          </Button>
          <Button onClick={() => act("revision")} disabled={busy} variant="outline">
            {t("requestRevision")}
          </Button>
        </div>
      )}

      {cancelable && (
        <Button onClick={() => act("cancel")} disabled={busy} variant="ghost" size="sm">
          {t("cancel")}
        </Button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
