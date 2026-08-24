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
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gigId }),
      });
      const j = await r.json();
      if (j.ok) window.location.href = `/${locale}/messages/${j.data.conversationId}`;
      else {
        setError(j.error?.message ?? t("contactError"));
        setBusy(false);
      }
    } catch {
      setError(t("contactError"));
      setBusy(false);
    }
  }

  return (
    <div className={fullWidth ? "w-full" : undefined}>
      <Button
        variant="outline"
        size={fullWidth ? "lg" : "sm"}
        className={fullWidth ? "w-full" : undefined}
        onClick={go}
        disabled={busy}
      >
        {busy ? "…" : `💬 ${t("contact")}`}
      </Button>
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-[hsl(var(--danger))]">
          {error}
        </p>
      )}
    </div>
  );
}
