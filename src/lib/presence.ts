/**
 * Presence heuristic shared by the messaging UI. A user counts as "online" if their
 * last-seen timestamp is within ONLINE_WINDOW_MS of now (a slightly-future timestamp
 * from clock skew still reads as online). Pure + deterministic so it can be unit-tested;
 * the human "last seen 2h ago" string is formatted by next-intl at the call site.
 */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export function isOnline(lastSeenMs: number | null | undefined, nowMs: number): boolean {
  if (lastSeenMs == null) return false;
  return nowMs - lastSeenMs < ONLINE_WINDOW_MS;
}
