"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Opt-in to selling: turns on isSeller + creates a SellerProfile, then opens the creator dashboard. */
export function BecomeCreatorButton({ locale }: { locale: string }) {
  const t = useTranslations("Gig");
  const [busy, setBusy] = useState(false);

  async function become() {
    setBusy(true);
    try {
      const r = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "sell" }),
      });
      const j = await r.json();
      if (j.ok) window.location.href = `/${locale}/dashboard/seller`;
      else setBusy(false);
    } catch {
      setBusy(false);
    }
  }

  return (
    <Button size="lg" onClick={become} disabled={busy}>
      {busy ? t("publishing") : t("becomeCreator")}
    </Button>
  );
}
