"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Buyer/seller dispute control on the order page. */
export function DisputeBox({ orderId, status }: { orderId: string; status: string }) {
  const t = useTranslations("Dispute");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "DISPUTED") {
    return (
      <p className="rounded-xl border border-[hsl(var(--border))] p-4 text-sm text-[hsl(var(--muted-foreground))]">
        {t("underReview")}
      </p>
    );
  }
  if (!["IN_PROGRESS", "DELIVERED", "REVISION"].includes(status)) return null;

  async function submit() {
    if (reason.trim().length < 5) {
      setError(t("reasonRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/orders/${orderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dispute", reason }),
    });
    const j = await r.json();
    if (j.ok) window.location.reload();
    else {
      setError(j.error?.message ?? t("error"));
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-4">
      {!open ? (
        <button onClick={() => setOpen(true)} aria-expanded={open} className="text-sm text-red-700 hover:underline">
          {t("open")}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("title")}</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("reasonPh")}
            aria-label={t("reasonPh")}
            className="min-h-20 w-full rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 py-2 text-sm"
          />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <Button variant="outline" size="sm" onClick={submit} disabled={busy}>
            {t("submit")}
          </Button>
        </div>
      )}
    </div>
  );
}
