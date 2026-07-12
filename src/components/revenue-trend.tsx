import { getTranslations } from "next-intl/server";
import { formatUzs } from "@/lib/utils";
import type { RevenueSeries } from "@/server/services/analytics";

/**
 * A compact weekly net-revenue trend for the seller dashboard. Static bars (no
 * motion) built from real completed-order earnings. Renders nothing when there's
 * no revenue yet — an empty chart would be noise, not information.
 */
export async function RevenueTrend({ weeks, totalUzs, weekCount }: RevenueSeries) {
  if (totalUzs <= 0) return null;
  const t = await getTranslations("Dash");
  const max = Math.max(...weeks, 1);

  return (
    <div className="mb-5 rounded-xl bg-[hsl(var(--surface-2))] p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            {t("revenueTrend")}
          </p>
          <p className="mt-0.5 text-lg font-extrabold tabular-nums">
            {formatUzs(totalUzs)}{" "}
            <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">so&apos;m</span>
          </p>
        </div>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">{t("revenuePeriod", { n: weekCount })}</span>
      </div>
      <div className="flex h-16 items-end gap-1.5" role="img" aria-label={t("revenueTrend")}>
        {weeks.map((w, i) => (
          <span
            key={i}
            className={`flex-1 rounded-t ${
              i === weeks.length - 1 ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--primary)/0.25)]"
            }`}
            style={{ height: `${Math.max(6, (w / max) * 100)}%` }}
            title={`${formatUzs(w)} so'm`}
          />
        ))}
      </div>
    </div>
  );
}
