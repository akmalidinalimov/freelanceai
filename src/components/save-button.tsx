"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Heart toggle to save/unsave a gig. */
export function SaveButton({
  gigId,
  locale,
  initialSaved,
  viewer,
}: {
  gigId: string;
  locale: string;
  initialSaved: boolean;
  viewer: "guest" | "buyer" | "owner";
}) {
  const t = useTranslations("Gig");
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  if (viewer === "owner") return null;

  async function go() {
    if (viewer === "guest") {
      window.location.href = `/${locale}/login`;
      return;
    }
    setBusy(true);
    const r = await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gigId }),
    });
    const j = await r.json();
    setBusy(false);
    if (j.ok) setSaved(j.data.saved);
  }

  return (
    <Button variant="ghost" size="sm" onClick={go} disabled={busy}>
      {saved ? `♥ ${t("saved")}` : `♡ ${t("save")}`}
    </Button>
  );
}
