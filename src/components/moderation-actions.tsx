"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function ModerationActions({ gigId }: { gigId: string }) {
  const t = useTranslations("Admin");
  const [busy, setBusy] = useState(false);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    const r = await fetch(`/api/gigs/${gigId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if ((await r.json()).ok) window.location.reload();
    else setBusy(false);
  }

  return (
    <span className="flex gap-2">
      <Button size="sm" variant="accent" onClick={() => act("approve")} disabled={busy}>
        {t("approve")}
      </Button>
      <Button size="sm" variant="outline" onClick={() => act("reject")} disabled={busy}>
        {t("reject")}
      </Button>
    </span>
  );
}
