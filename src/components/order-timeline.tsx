import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Order journey stepper: Pending payment -> In progress -> Delivered -> Completed.
 * Horizontal on desktop, vertical on mobile. Done = filled accent + check;
 * current = pulsing accent ring (static under reduced-motion via the global rule);
 * future = muted outline. Branch statuses (REVISION / DISPUTED / CANCELLED) show a
 * banner above the stepper. Handles all statuses + a safe fallback.
 */
const STEPS = ["PENDING_PAYMENT", "IN_PROGRESS", "DELIVERED", "COMPLETED"] as const;

function stepIndexFor(status: string): number {
  switch (status) {
    case "PENDING_PAYMENT":
      return 0;
    case "IN_PROGRESS":
    case "REVISION":
      return 1;
    case "DELIVERED":
      return 2;
    case "COMPLETED":
      return 3;
    default:
      return 0; // CANCELLED / DISPUTED / unknown — banner carries the real state
  }
}

export async function OrderTimeline({ status }: { status: string }) {
  const t = await getTranslations("Order");

  const completed = status === "COMPLETED";
  const cancelled = status === "CANCELLED";
  const current = completed ? -1 : stepIndexFor(status);

  const banner =
    status === "REVISION"
      ? { tone: "info", text: t("bannerRevision") }
      : status === "DISPUTED"
        ? { tone: "danger", text: t("bannerDisputed") }
        : status === "CANCELLED"
          ? { tone: "muted", text: t("bannerCancelled") }
          : null;

  const bannerTone: Record<string, string> = {
    info: "border-[hsl(var(--info))]/40 bg-[hsl(var(--info-soft))] text-[hsl(var(--info))]",
    danger: "border-[hsl(var(--danger))]/40 bg-[hsl(var(--danger-soft))] text-[hsl(var(--danger))]",
    muted: "border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:p-5">
      {banner && (
        <div className={cn("mb-4 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium", bannerTone[banner.tone])}>
          {banner.text}
        </div>
      )}

      <ol className={cn("flex flex-col gap-0 sm:flex-row sm:gap-2", cancelled && "opacity-60")}>
        {STEPS.map((step, i) => {
          const done = completed || i < current;
          const isCurrent = i === current && !cancelled;
          const last = i === STEPS.length - 1;
          return (
            <li key={step} className="flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center">
              <div className="flex flex-col items-center sm:w-full sm:flex-row">
                <span
                  className={cn(
                    "relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold",
                    done
                      ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
                      : isCurrent
                        ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
                        : "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                  {isCurrent && (
                    <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-[hsl(var(--accent))]" aria-hidden />
                  )}
                </span>
                {/* Connector */}
                {!last && (
                  <span
                    className={cn(
                      "my-1 h-6 w-px sm:my-0 sm:mx-2 sm:h-px sm:flex-1",
                      done ? "bg-[hsl(var(--accent))]" : "bg-[hsl(var(--border))]"
                    )}
                    aria-hidden
                  />
                )}
              </div>
              <span
                className={cn(
                  "pb-4 text-xs font-medium sm:pb-0 sm:pt-2",
                  done || isCurrent ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"
                )}
              >
                {t(`status.${step}`)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
