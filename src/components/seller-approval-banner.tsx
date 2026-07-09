"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import type { ApprovalState } from "@/server/services/seller-approval";

/**
 * Approval-status banner at the top of the seller dashboard. Renders one of four
 * calm states (incomplete / pending / approved / rejected) and, when the seller is
 * eligible, a "Submit for approval" button that POSTs and reloads.
 */
export function SellerApprovalBanner({ state }: { state: ApprovalState }) {
  const t = useTranslations("SellerApproval");
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const r = await fetch("/api/me/seller/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const j = await r.json();
    if (j.ok) {
      toast(t("submitted"), "success");
      window.location.reload();
    } else {
      toast(j.error?.message ?? t("error"), "error");
      setBusy(false);
    }
  }

  if (state.status === "APPROVED") {
    return (
      <div className="mb-5 flex items-center gap-2 rounded-xl border border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/10 px-4 py-2.5 text-sm">
        <span aria-hidden>✓</span>
        <span className="font-medium text-[hsl(var(--foreground))]">{t("liveTitle")}</span>
        <span className="text-[hsl(var(--muted-foreground))]">{t("liveBody")}</span>
      </div>
    );
  }

  if (state.status === "PENDING") {
    return (
      <div className="mb-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <h2 className="font-semibold">{t("pendingTitle")}</h2>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t("pendingBody")}</p>
      </div>
    );
  }

  const isRejected = state.status === "REJECTED";

  return (
    <div className="mb-5 rounded-xl border border-[hsl(var(--warning-soft))] bg-[hsl(var(--warning-soft))]/40 p-5">
      <h2 className="font-semibold">{isRejected ? t("rejectedTitle") : t("incompleteTitle")}</h2>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        {isRejected ? t("rejectedBody") : t("incompleteBody")}
      </p>

      {isRejected && state.rejectionReason && (
        <p className="mt-3 rounded-lg bg-[hsl(var(--card))] px-3 py-2 text-sm">
          <span className="font-medium">{t("reasonLabel")}: </span>
          {state.rejectionReason}
        </p>
      )}

      {state.missing.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {state.missing.map((m) => (
            <li key={m} className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
              <span
                aria-hidden
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--border))] text-xs"
              />
              {t(`missing.${m}`)}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <Button onClick={submit} disabled={!state.canSubmit || busy}>
          {isRejected ? t("resubmit") : t("submit")}
        </Button>
      </div>
    </div>
  );
}
