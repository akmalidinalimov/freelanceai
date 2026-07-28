import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * Designed empty state: icon in a soft accent circle + title + one-line hint +
 * ONE call to action. Used wherever a list can be legitimately empty (no fabricated
 * example content).
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  ctaLabel,
  ctaHref,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]">
        <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </span>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {hint && <p className="max-w-sm text-sm text-[hsl(var(--muted-foreground))]">{hint}</p>}
      {ctaLabel && ctaHref && (
        <Link href={ctaHref} className="mt-2">
          <Button>{ctaLabel}</Button>
        </Link>
      )}
    </div>
  );
}
