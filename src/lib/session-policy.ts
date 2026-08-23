import "server-only";

/**
 * An absolute ceiling on a rolling session.
 *
 * Sessions roll forward from last use so an active user is never logged out, which is what makes
 * the app feel like an app. Left alone, though, "rolls forever" is not a session — it is a
 * permanent credential. A cookie exfiltrated once, or a device kept after it changed hands, stays
 * valid indefinitely as long as something touches it inside the window. For accounts that hold a
 * balance, KYC state and order history, that is the wrong default.
 *
 * So the JWT carries its own birthday and expires 90 days after ISSUE regardless of activity. The
 * user signs in again roughly quarterly; inside Telegram that costs zero taps, because initData
 * re-authenticates silently.
 */
export const ABSOLUTE_SESSION_MAX_AGE_SEC = 90 * 24 * 60 * 60;

/** Pure so it is testable without a running auth stack. */
export function shouldExpireSession(
  token: Record<string, unknown>,
  nowSec: number
): boolean {
  const absExp = typeof token.absExp === "number" ? token.absExp : null;
  // Tokens issued before this existed have no birthday. Do not log those users out retroactively —
  // they get stamped on their next refresh and age out from there.
  if (absExp === null) return false;
  return nowSec >= absExp;
}

/** The birthday to stamp at the login moment. */
export function absoluteExpiry(nowSec: number): number {
  return nowSec + ABSOLUTE_SESSION_MAX_AGE_SEC;
}
