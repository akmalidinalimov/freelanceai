"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";

const field = "h-9 rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 text-sm";

/** Admin approve / reject controls for one pending seller. Reject reveals a reason field. */
export function AdminSellerActions({ profileId }: { profileId: string }) {
  const t = useTranslations("Admin");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    const r = await fetch("/api/admin/sellers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j.ok) window.location.reload();
    else {
      toast(j.error?.message ?? t("error"), "error");
      setBusy(false);
    }
  }

  if (rejecting) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("sellerRejectReasonPh")}
          className={`${field} w-56`}
          aria-label={t("sellerRejectReasonPh")}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy || reason.trim().length === 0}
          onClick={() => post({ action: "reject", profileId, reason: reason.trim() })}
        >
          {t("reject")}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRejecting(false)}>
          {t("cancel")}
        </Button>
      </span>
    );
  }

  return (
    <span className="flex gap-2">
      <Button size="sm" variant="accent" disabled={busy} onClick={() => post({ action: "approve", profileId })}>
        {t("approve")}
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
        {t("reject")}
      </Button>
    </span>
  );
}
