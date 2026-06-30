"use client";

import { useState } from "react";

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
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

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
    if (j.ok) setSaved(j.data.saved);
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label="save"
      className="absolute right-2 top-2 z-10 rounded-full bg-black/40 px-2 py-0.5 text-sm text-white backdrop-blur transition-colors hover:bg-black/60"
    >
      {saved ? "♥" : "♡"}
    </button>
  );
}
