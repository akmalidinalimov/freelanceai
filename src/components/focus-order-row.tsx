import { Link } from "@/i18n/navigation";
import { StatusChip } from "@/components/status-chip";
import { formatUzs } from "@/lib/utils";
import type { DueMeta } from "@/lib/order-due";

/**
 * A rich order row for the Focus dashboards — colored avatar, title link, status
 * chip, a deadline/next-step phrase, the counterpart, and the amount. Shared by
 * the seller ("orders to fulfill") and buyer ("your orders") lists so they read
 * identically. Presentational only.
 */
const GRAD = [
  "linear-gradient(135deg, hsl(173 70% 40%), hsl(196 75% 45%))",
  "linear-gradient(135deg, hsl(11 80% 60%), hsl(340 75% 58%))",
  "linear-gradient(135deg, hsl(262 60% 58%), hsl(218 75% 55%))",
];
const DUE_TONE: Record<string, string> = {
  soon: "text-[hsl(var(--warning))]",
  over: "text-[hsl(var(--danger))]",
  ok: "text-[hsl(var(--muted-foreground))]",
};

export function FocusOrderRow({
  href,
  title,
  status,
  statusLabel,
  due,
  counterpart,
  initial,
  amountUzs,
  variant,
}: {
  href: string;
  title: string;
  status: string;
  statusLabel: string;
  due: DueMeta | null;
  counterpart: string;
  initial: string;
  amountUzs: number;
  variant: number;
}) {
  return (
    <li className="flex items-center gap-3 border-t border-[hsl(var(--border))] py-3 first:border-t-0">
      <span
        aria-hidden
        className="grid h-9 w-9 flex-none place-items-center rounded-[10px] text-sm font-bold text-white"
        style={{ backgroundImage: GRAD[variant % GRAD.length] }}
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <Link href={href} className="block truncate font-semibold hover:underline">
          {title}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <StatusChip status={status} label={statusLabel} />
          {due && <span className={`font-semibold ${DUE_TONE[due.tone]}`}>{due.text}</span>}
          <span className="truncate">· {counterpart}</span>
        </div>
      </div>
      <span className="flex-none font-bold tabular-nums">
        {formatUzs(amountUzs)} <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">so&apos;m</span>
      </span>
    </li>
  );
}
