"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

/** Compact heart overlay for gig cards (works inside a card Link via preventDefault). */
export function SaveHeart({
  gigId,
  locale,
  initialSaved,
  isGuest,
}: {
  gigId: string;
  locale: string;
  initialSaved: boolean;
  isGuest: boolean;
}) {
  const t = useTranslations("Gig");
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [pop, setPop] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isGuest) {
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
    if (j.ok) {
      setSaved(j.data.saved);
      if (j.data.saved) {
        setPop(true);
        setTimeout(() => setPop(false), 250);
      }
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={t("wishlist")}
      className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
    >
      <Heart
        className={cn(
          "h-4 w-4 transition-transform duration-200 ease-out",
          saved && "fill-current",
          pop && "scale-125"
        )}
      />
    </button>
  );
}
