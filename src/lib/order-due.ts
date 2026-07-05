/**
 * Shared, i18n-aware helpers for the Focus dashboards: how an order's deadline
 * reads to each side, and how to name the counterpart. Kept pure (the translator
 * is injected) so both the seller and buyer dashboards format identically.
 */

export type DueTone = "soon" | "ok" | "over";
export interface DueMeta {
  text: string;
  tone: DueTone;
}

type T = (key: string, values?: Record<string, string | number>) => string;

/**
 * A short deadline/next-step phrase for an order row, from the viewer's side.
 * Returns null when there's nothing time-relevant to say (e.g. a fresh PAID order
 * with no due date, or a terminal status). `now` is injectable for testing.
 */
export function orderDueMeta(
  status: string,
  dueAt: Date | string | null | undefined,
  viewer: "seller" | "buyer",
  t: T,
  now: number = Date.now(),
): DueMeta | null {
  if (status === "DELIVERED") {
    return viewer === "seller"
      ? { text: t("awaitingApproval"), tone: "ok" }
      : { text: t("reviewNeeded"), tone: "soon" };
  }
  if (status === "REVISION") return { text: t("revisionRequested"), tone: "soon" };
  if (!dueAt || (status !== "IN_PROGRESS" && status !== "PAID")) return null;

  const ms = (dueAt instanceof Date ? dueAt : new Date(dueAt)).getTime();
  if (Number.isNaN(ms)) return null;
  const days = Math.ceil((ms - now) / 86_400_000);
  if (days < 0) return { text: t("overdue"), tone: "over" };
  if (days === 0) return { text: t("dueToday"), tone: "soon" };
  if (days === 1) return { text: t("dueTomorrow"), tone: "soon" };
  return { text: t("dueInDays", { n: days }), tone: days <= 2 ? "soon" : "ok" };
}

/** Best human name for the order counterpart, falling back to a generic label. */
export function displayName(
  u: { firstName?: string | null; name?: string | null; username?: string | null } | null | undefined,
  fallback: string,
): string {
  if (!u) return fallback;
  return u.firstName || u.name || (u.username ? `@${u.username}` : fallback);
}

/** First letter for the row avatar (deterministic, never empty). */
export function initialOf(name: string): string {
  const c = name.replace(/^@/, "").trim().charAt(0);
  return c ? c.toUpperCase() : "•";
}
