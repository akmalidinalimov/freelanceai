"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** "Contact freelancer" — opens (or reopens) a direct conversation with the gig's seller. */
export function ContactSellerButton({
  gigId,
  locale,
  viewer,
}: {
  gigId: string;
  locale: string;
  viewer: "guest" | "buyer" | "owner";
}) {
  const t = useTranslations("Message");
  const [busy, setBusy] = useState(false);

  if (viewer === "owner") return null;

  async function go() {
    if (viewer === "guest") {
      window.location.href = `/${locale}/login`;
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gigId }),
      });
      const j = await r.json();
      if (j.ok) window.location.href = `/${locale}/messages/${j.data.conversationId}`;
      else setBusy(false);
    } catch {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={go} disabled={busy}>
      {busy ? "…" : t("contact")}
    </Button>
  );
}
