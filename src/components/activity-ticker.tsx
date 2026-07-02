"use client";

/**
 * Dark scrolling activity bar under the header. Items are REAL recent marketplace
 * events (completed orders, fresh ratings, new creators) composed server-side from
 * listRecentActivity — never invented copy. Renders nothing when there's no activity.
 */
export function ActivityTicker({ items }: { items: string[] }) {
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
