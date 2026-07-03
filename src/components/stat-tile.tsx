import type { LucideIcon } from "lucide-react";
import { cardClass } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * One dashboard stat tile: big tabular number + small muted label + optional tiny
 * accent icon. One primitive so every dashboard stat reads the same.
 */
export function StatTile({
  value,
  label,
  icon: Icon,
  className,
}: {
  value: React.ReactNode;
  label: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cardClass(false, cn("p-4", className))}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xl font-bold tabular-nums leading-tight sm:text-2xl">{value}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-[hsl(var(--accent))]" aria-hidden />}
      </div>
      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
    </div>
  );
}
