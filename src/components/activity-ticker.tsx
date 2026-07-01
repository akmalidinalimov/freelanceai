"use client";

import { useTranslations } from "next-intl";

/** Dark scrolling activity bar under the header — signals a live marketplace. */
export function ActivityTicker() {
  const t = useTranslations("Home");
  const items = (t.raw("tickerItems") as string[]) ?? [];
  if (items.length === 0) return null;
  const loop = [...items, ...items];

  return (
    <div className="overflow-hidden border-b border-[hsl(var(--border))] bg-[hsl(var(--foreground))] text-[hsl(var(--background))]">
      <div className="flex w-max animate-[ticker_28s_linear_infinite] gap-9 whitespace-nowrap py-1.5 text-xs font-semibold">
        {loop.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            <span className="text-[hsl(var(--primary))]">●</span>
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
