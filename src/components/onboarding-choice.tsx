"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Briefcase, Palette } from "lucide-react";

/** First-login intent selection. Posts the choice, then redirects into the app. */
export function OnboardingChoice({ locale }: { locale: string }) {
  const t = useTranslations("Onboarding");
  const [busy, setBusy] = useState<"buy" | "sell" | null>(null);
  const [error, setError] = useState(false);

  async function choose(intent: "buy" | "sell") {
    setBusy(intent);
    setError(false);
    try {
      const r = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
      });
      const j = await r.json();
      if (j.ok) {
        window.location.href = intent === "sell" ? `/${locale}/sell` : `/${locale}/gigs`;
      } else {
        setError(true);
        setBusy(null);
      }
    } catch {
      setError(true);
      setBusy(null);
    }
  }

  const cards = [
    { intent: "buy" as const, icon: Briefcase, title: t("hire"), desc: t("hireDesc") },
    { intent: "sell" as const, icon: Palette, title: t("offer"), desc: t("offerDesc") },
  ];

  return (
    <div className="flex w-full flex-col gap-4">
      {cards.map(({ intent, icon: Icon, title, desc }) => (
        <button
          key={intent}
          onClick={() => choose(intent)}
          disabled={busy !== null}
          className="flex items-start gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left transition-colors hover:border-[hsl(var(--primary))] disabled:opacity-60"
        >
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary-ink))]">
            <Icon size={20} />
          </span>
          <span>
            <span className="block font-semibold">
              {title}
              {busy === intent ? " …" : ""}
            </span>
            <span className="block text-sm text-[hsl(var(--muted-foreground))]">{desc}</span>
          </span>
        </button>
      ))}
      {error && <p className="text-sm text-red-600">{t("error")}</p>}
    </div>
  );
}
