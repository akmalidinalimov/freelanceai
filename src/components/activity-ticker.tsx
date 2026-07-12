"use client";

/**
 * Quiet scrolling activity strip under the header. Items are REAL recent
 * marketplace events (completed orders, fresh ratings, new creators) composed
 * server-side from listRecentActivity — never invented copy. Renders nothing
 * when there's no activity. Edge-fade masks let each item ease in/out gently at
 * the strip's ends; the marquee is one of the few sanctioned self-moving elements.
 */
export function ActivityTicker({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  const loop = [...items, ...items];

  return (
    <div
      aria-label="Recent activity"
      className="overflow-hidden border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/60"
      style={{
        maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
        WebkitMaskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
      }}
    >
      <div className="flex w-max animate-[ticker_34s_linear_infinite] gap-8 whitespace-nowrap py-1.5 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
        {loop.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-[hsl(var(--primary))]" aria-hidden />
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
