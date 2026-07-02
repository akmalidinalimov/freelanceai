"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface Pending {
  requestedById: string;
  reason: string;
}

/** Mutual order-cancellation UI: request, or (the other party) approve / decline. */
export function CancellationBox({
  orderId,
  canRequest,
  pending,
  currentUserId,
}: {
  orderId: string;
  canRequest: boolean;
  pending: Pending | null;
  currentUserId: string;
}) {
  const t = useTranslations("Cancel");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await fetch(`/api/orders/${orderId}/cancellation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if ((await r.json()).ok) window.location.reload();
      else setBusy(false);
    } catch {
      setBusy(false);
    }
  }

  if (pending) {
    const mine = pending.requestedById === currentUserId;
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] p-4">
        <p className="text-sm font-medium">{t("title")}</p>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{pending.reason}</p>
        {mine ? (
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{t("waiting")}</p>
        ) : (
          <div className="mt-3 flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => send({ action: "approve" })}>
              {t("approve")}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => send({ action: "decline" })}>
              {t("decline")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (!canRequest) return null;
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-4">
      {open ? (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("reasonPh")}
            className="min-h-20 w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || reason.trim().length < 5}
              onClick={() => send({ action: "request", reason: reason.trim() })}
            >
              {t("submit")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="text-sm text-[hsl(var(--muted-foreground))] hover:underline"
        >
          {t("request")}
        </button>
      )}
    </div>
  );
}
