import { cn } from "@/lib/utils";

/**
 * Order-status chip — defined once, reused across dashboards and the order page.
 * Soft tinted background + readable ink in both themes; the text label always
 * shows so color is never the only carrier. Unknown statuses fall back to muted.
 */
const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))]",
  IN_PROGRESS: "bg-[hsl(var(--info-soft))] text-[hsl(var(--info))]",
  DELIVERED: "bg-[hsl(var(--violet-soft))] text-[hsl(var(--violet))]",
  REVISION: "border border-[hsl(var(--info))]/40 text-[hsl(var(--info))]",
  COMPLETED: "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]",
  CANCELLED: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  DISPUTED: "bg-[hsl(var(--danger-soft))] text-[hsl(var(--danger))]",
};

export function StatusChip({
  status,
  label,
  className,
}: {
  status: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STATUS_STYLES[status] ?? "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
        className
      )}
    >
      {label}
    </span>
  );
}
