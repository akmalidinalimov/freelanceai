import { Link } from "@/i18n/navigation";

/**
 * The signature of the "Focus" dashboards: a short row of the 1–3 things that
 * need the user right now (deliver, withdraw, review…), rendered as actionable
 * cards — not stats. Renders nothing when there's nothing to act on, so a calm
 * dashboard stays calm. Purely presentational; the page derives the items.
 */
export type PriorityTone = "warn" | "money" | "info";
export type PriorityCta = "primary" | "coral" | "outline";

export interface PriorityItem {
  tone: PriorityTone;
  tag: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  ctaTone?: PriorityCta;
}

const CARD: Record<PriorityTone, string> = {
  warn: "border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning-soft))]/60",
  money: "border-[hsl(var(--primary))]/35 bg-[hsl(var(--primary))]/[0.06]",
  info: "border-[hsl(var(--border))] bg-[hsl(var(--card))]",
};
const TAG: Record<PriorityTone, string> = {
  warn: "text-[hsl(var(--warning))]",
  money: "text-[hsl(var(--primary-ink))]",
  info: "text-[hsl(var(--info))]",
};
const BTN: Record<PriorityCta, string> = {
  primary: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
  coral: "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]",
  outline: "border border-[hsl(var(--input-border))] text-[hsl(var(--foreground))]",
};

export function PriorityStrip({ items }: { items: PriorityItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((p, i) => (
        <div
          key={i}
          className={`flex flex-col gap-2 rounded-2xl border p-4 ${CARD[p.tone]}`}
          style={{ boxShadow: "var(--shadow-soft)" }}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wide ${TAG[p.tone]}`}>{p.tag}</span>
          <span className="text-base font-bold leading-tight tabular-nums">{p.title}</span>
          <span className="text-[13px] text-[hsl(var(--muted-foreground))]">{p.detail}</span>
          <Link
            href={p.href}
            className={`mt-auto inline-flex w-fit items-center rounded-lg px-3 py-1.5 text-[13px] font-bold ${BTN[p.ctaTone ?? "primary"]}`}
          >
            {p.cta}
          </Link>
        </div>
      ))}
    </div>
  );
}
