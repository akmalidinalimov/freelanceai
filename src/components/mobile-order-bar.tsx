"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatUzs } from "@/lib/utils";

/**
 * Sticky price + CTA bar for phones (hidden on lg+, where the order panel is a
 * sticky aside). At 390px the panel sits several screens below the fold; this bar
 * keeps the price and "Buyurtma berish" always reachable and scrolls the buyer to
 * the panel. Hides itself while the panel is actually in view.
 * On <md it sits above MobileBottomNav; md–lg has no bottom nav, so it sits flush.
 */
export function MobileOrderBar({
  fromPriceUzs,
  targetId,
}: {
  fromPriceUzs: number;
  targetId: string;
}) {
  const t = useTranslations("Gig");
  const to = useTranslations("Order");
  const [panelInView, setPanelInView] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => setPanelInView(e.isIntersecting), {
      // count the panel as "in view" once a meaningful slice of it shows
      threshold: 0.25,
    });
    obs.observe(target);
    return () => obs.disconnect();
  }, [targetId]);

  function goToPanel() {
    // no funnel event here: this scrolls to the panel, it doesn't start an order
    const target = document.getElementById(targetId);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  if (panelInView) return null;

  return (
    <div
      className="fixed inset-x-0 z-40 flex items-center justify-between gap-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 px-4 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur bottom-[calc(53px+env(safe-area-inset-bottom))] md:bottom-0 lg:hidden"
    >
      <span className="min-w-0">
        <span className="block text-[11px] text-[hsl(var(--muted-foreground))]">{t("fromPrice")}</span>
        <span className="block text-base font-bold tabular-nums leading-tight">
          {formatUzs(fromPriceUzs)} so&apos;m
        </span>
      </span>
      {/* Scroll-intent verb, NOT "Buyurtma berish" — this jumps to the panel, it
          doesn't place the order (critique P3: the identical label made the first
          tap feel like a dead action). */}
      <Button size="lg" className="shrink-0" onClick={goToPanel}>
        {to("goToOrder")}
      </Button>
    </div>
  );
}
