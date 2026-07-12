"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import type { ApprovalState, ApprovalMissing } from "@/server/services/seller-approval";

// The (short, fixed) path to going live, in order — each step links straight to where it's done.
const REQUIREMENTS: ApprovalMissing[] = ["headline", "bio", "specialization", "gig"];
const STEP_LINK: Record<ApprovalMissing, string> = {
  headline: "/dashboard/seller/profile",
  bio: "/dashboard/seller/profile",
  specialization: "/dashboard/seller/profile",
  gig: "/dashboard/seller/gigs/new",
};

/**
 * Approval-status banner at the top of the seller dashboard. Renders one of four
 * calm states (incomplete / pending / approved / rejected). In the incomplete/rejected
 * state it's a GUIDED checklist: a progress bar + tappable steps (each links to its fix) +
 * a submit button that lights up the moment every step is done — so "am I ready? how do I
 * submit?" is one obvious panel, not a hunt across pages.
 */
export function SellerApprovalBanner({
  state,
  pendingGigCount = 0,
}: {
  state: ApprovalState;
  /** Gigs still in admin review — even an APPROVED seller isn't visible until these clear. */
  pendingGigCount?: number;
}) {
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
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/10 px-4 py-2.5 text-sm">
        <span aria-hidden>✓</span>
        <span className="font-medium text-[hsl(var(--foreground))]">{t("liveTitle")}</span>
        <span className="text-[hsl(var(--muted-foreground))]">{t("liveBody")}</span>
        {pendingGigCount > 0 && (
          // Approved seller, but a gig is still in review — say so, or they think it's hidden by a bug.
          <span className="basis-full text-[hsl(var(--muted-foreground))]">
            ⏳ {t("gigsInReview", { count: pendingGigCount })}
          </span>
        )}
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

      {(() => {
        const done = REQUIREMENTS.filter((r) => !state.missing.includes(r)).length;
        return (
          <>
            {/* Progress toward going live — a short, finishable bar. */}
            <div className="mt-3 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                <div
                  className="h-full rounded-full bg-[hsl(var(--primary))] transition-all"
                  style={{ width: `${(done / REQUIREMENTS.length) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium tabular-nums text-[hsl(var(--muted-foreground))]">
                {t("progress", { done, total: REQUIREMENTS.length })}
              </span>
            </div>

            {/* Tappable steps: done ones are checked off; the rest link straight to their fix. */}
            <ul className="mt-3 space-y-1.5">
              {REQUIREMENTS.map((r) => {
                const isDone = !state.missing.includes(r);
                return (
                  <li key={r} className="flex items-center gap-2 text-sm">
                    <span
                      aria-hidden
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                        isDone
                          ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                          : "border border-[hsl(var(--border))]"
                      }`}
                    >
                      {isDone ? "✓" : ""}
                    </span>
                    {isDone ? (
                      <span className="text-[hsl(var(--muted-foreground))] line-through">{t(`missing.${r}`)}</span>
                    ) : (
                      <Link href={STEP_LINK[r]} className="font-medium text-[hsl(var(--primary-ink))] hover:underline">
                        {t(`missing.${r}`)}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        );
      })()}

      <div className="mt-4">
        <Button onClick={submit} disabled={!state.canSubmit || busy}>
          {isRejected ? t("resubmit") : state.canSubmit ? t("submitReady") : t("submit")}
        </Button>
        {!state.canSubmit && !isRejected && (
          <p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">{t("submitLocked")}</p>
        )}
      </div>
    </div>
  );
}
