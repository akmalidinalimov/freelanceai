"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Admin-only toggle to feature/unfeature a gig (boosts it in listings). */
export function FeatureGigButton({ gigId, featured }: { gigId: string; featured: boolean }) {
  const t = useTranslations("Gig");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const r = await fetch(`/api/gigs/${gigId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: featured ? "unfeature" : "feature" }),
      });
      if ((await r.json()).ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant={featured ? "outline" : "default"} onClick={toggle} disabled={busy}>
      {featured ? t("unfeature") : t("feature")}
    </Button>
  );
}
