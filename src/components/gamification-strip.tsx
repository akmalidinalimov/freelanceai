import { getTranslations } from "next-intl/server";
import { badgeDef, badgeLabel, xpLevel } from "@/lib/badges";

/**
 * Compact XP / streak / badges strip for the dashboards (server component).
 * Deliberately low-key on loss-pressure: streak shows only when ≥2 days (research:
 * daily-streak anxiety fits daily-use apps, not an episodic marketplace).
 */
export async function GamificationStrip({
  locale,
  xp,
  streakDays,
  badges,
  completeness,
  weeklyRank,
}: {
  locale: string;
  xp: number;
  streakDays: number;
  badges: Array<{ key: string }>;
  completeness?: { score: number; missing: string[] } | null;
  weeklyRank?: number | null;
}) {
  const t = await getTranslations("Gamification");
  const level = xpLevel(xp, locale);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 px-4 py-3">
      <span className="rounded-full bg-[hsl(var(--primary))]/10 px-2.5 py-1 text-xs font-semibold text-[hsl(var(--primary-ink))]">
        {level.label} · {xp} XP
        {level.nextAt !== null && (
          <span className="ml-1 font-normal text-[hsl(var(--muted-foreground))]">
            {t("nextLevel", { xp: level.nextAt - xp })}
          </span>
        )}
      </span>
      {typeof weeklyRank === "number" && (
        <span className="rounded-full bg-[hsl(var(--success-soft))] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--success))]">
          🏅 {t("weeklyRank", { rank: weeklyRank })}
        </span>
      )}
      {streakDays >= 2 && (
        <span className="rounded-full bg-[hsl(var(--warning-soft))] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--warning))]">
          🔥 {t("streak", { days: streakDays })}
        </span>
      )}
      {badges.map((b) => {
        const def = badgeDef(b.key);
        if (!def) return null;
        return (
          <span
            key={b.key}
            title={badgeLabel(b.key, locale)}
            className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1 text-xs"
          >
            {def.emoji} {badgeLabel(b.key, locale)}
          </span>
        );
      })}
      {completeness && completeness.score < 100 && (
        <>
          <span className="rounded-full border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning-soft))] px-2.5 py-1 text-xs font-medium text-[hsl(var(--warning))]">
            {t("profileScore", { score: completeness.score })}
          </span>
          {/* The actionable per-item missing list now lives in the single profile-strength
              checklist at the top of the dashboard; here we keep just the % score to avoid
              two competing checklists. */}
        </>
      )}
    </div>
  );
}
