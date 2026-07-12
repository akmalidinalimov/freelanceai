"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function DisputeActions({ disputeId }: { disputeId: string }) {
  const t = useTranslations("Dispute");
  const [busy, setBusy] = useState(false);

  async function act(resolution: "refund" | "release") {
    setBusy(true);
    const r = await fetch(`/api/admin/disputes/${disputeId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution }),
    });
    if ((await r.json()).ok) window.location.reload();
    else setBusy(false);
  }

  return (
    <span className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => act("refund")} disabled={busy}>
        {t("refund")}
      </Button>
      <Button size="sm" variant="accent" onClick={() => act("release")} disabled={busy}>
        {t("release")}
      </Button>
    </span>
  );
}
