"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Approve / reject-with-reason for the gig moderation queue. The reason is required
 * in this UI (a blind rejection teaches the seller nothing) and rides their notice. */
export function ModerationActions({ gigId }: { gigId: string }) {
  const t = useTranslations("Admin");
  const [busy, setBusy] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  async function act(action: "approve" | "reject", extra?: Record<string, string>) {
    setBusy(true);
    const r = await fetch(`/api/gigs/${gigId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    if ((await r.json()).ok) window.location.reload();
    else setBusy(false);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <span className="flex gap-2">
        <Button size="sm" variant="accent" onClick={() => act("approve")} disabled={busy}>
          {t("approve")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowReject((s) => !s)} disabled={busy}>
          {t("reject")}…
        </Button>
      </span>
      {showReject && (
        <span className="flex w-full min-w-64 gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("rejectReasonPh")}
            aria-label={t("rejectReasonPh")}
            maxLength={500}
            className="h-9 flex-1 rounded-md border border-[hsl(var(--input-border))] bg-transparent px-2 text-sm"
          />
          <Button
            size="sm"
            variant="destructive"
            disabled={busy || reason.trim().length < 3}
            onClick={() => act("reject", { reason: reason.trim() })}
          >
            {t("reject")}
          </Button>
        </span>
      )}
    </div>
  );
}
