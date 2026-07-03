/**
 * Presence heuristic shared by the messaging UI. A user counts as "online" if their
 * last-seen timestamp is within ONLINE_WINDOW_MS of now (a slightly-future timestamp
 * from clock skew still reads as online). Pure + deterministic so it can be unit-tested;
 * the human "last seen 2h ago" string is formatted by next-intl at the call site.
 *
 * The window MUST exceed the lastSeenAt write throttle (15 min, see activity.ts) —
 * otherwise a continuously-active user whose write is throttled reads as "offline"
 * for most of each interval. 20 min gives a comfortable margin over the 15-min throttle.
 */
export const ONLINE_WINDOW_MS = 20 * 60 * 1000; // 20 minutes (> 15-min lastSeenAt throttle)

export function isOnline(lastSeenMs: number | null | undefined, nowMs: number): boolean {
  if (lastSeenMs == null) return false;
  return nowMs - lastSeenMs < ONLINE_WINDOW_MS;
}
