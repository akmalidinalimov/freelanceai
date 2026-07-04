"use client";

import { useState } from "react";
import { track } from "@/lib/track";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** "Contact freelancer" — opens (or reopens) a direct conversation with the gig's seller. */
export function ContactSellerButton({
  gigId,
  locale,
  viewer,
  fullWidth = false,
}: {
  gigId: string;
  locale: string;
  viewer: "guest" | "buyer" | "owner";
  /** order-panel placement: full-width secondary action right under the CTA */
  fullWidth?: boolean;
}) {
  const t = useTranslations("Message");
  const [busy, setBusy] = useState(false);

  if (viewer === "owner") return null;

  async function go() {
    track("contact_cta_click", gigId);
    if (viewer === "guest") {
      // Return the buyer to this gig after login instead of dumping them home.
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `/${locale}/login?next=${next}`;
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
    <Button
      variant="outline"
      size={fullWidth ? "lg" : "sm"}
      className={fullWidth ? "w-full" : undefined}
      onClick={go}
      disabled={busy}
    >
      {busy ? "…" : `💬 ${t("contact")}`}
    </Button>
  );
}
