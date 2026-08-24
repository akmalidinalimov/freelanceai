"use client";

import { getCsrfToken, signIn } from "next-auth/react";

/**
 * One Mini App sign-in per page load, shared by every caller.
 *
 * Two components independently attempted it: TelegramMiniAppBootstrap, mounted in the layout on
 * EVERY page, and TelegramAuthGate on /login. Each `signIn()` internally fetches /api/auth/csrf,
 * and @auth/core mints a FRESH csrf token and cookie on every such call — so two concurrent
 * attempts produced two cookies, the second overwrote the first, and whichever POST carried the
 * losing token failed `MissingCSRF`.
 *
 * The user-visible result was the worst possible one: the winner signed them in while the loser
 * painted "automatic sign-in didn't work" over a session that existed. Reported from a real device
 * as a login screen that would not go away.
 *
 * So: warm the csrf cookie exactly once, then let the first caller own the attempt and everyone
 * else await the same promise.
 */
export type SignInOutcome = {
  ok: boolean;
  /** next-auth's own error string when it gave one — "MissingCSRF", "Configuration", … */
  error?: string;
  /** True when the request never completed (offline, blocked, non-JSON response). */
  network?: boolean;
};

let inFlight: Promise<SignInOutcome> | null = null;

/** True when this browser currently holds a real Auth.js session. */
export async function hasSession(): Promise<boolean> {
  try {
    const r = await fetch("/api/auth/session", { cache: "no-store" });
    const j = await r.json();
    return Boolean(j?.user?.id);
  } catch {
    return false;
  }
}

async function attempt(providerId: string, credentials: Record<string, string>): Promise<SignInOutcome> {
  try {
    // Warm the cookie before signIn does it implicitly. With one caller doing this first, the
    // concurrent mint that caused MissingCSRF cannot happen.
    await getCsrfToken();
  } catch {
    // Not fatal on its own — signIn fetches it again. Let the real attempt report the failure.
  }

  const res = await signIn(providerId, { ...credentials, redirect: false }).catch(() => null);
  if (!res) return { ok: false, network: true };
  if (res.error) return { ok: false, error: res.error };
  // `res.ok` is true even for server-side rejections (auth.js answers 200 with an error in the
  // url), so `error` above is the real signal and this is only a transport check.
  return { ok: res.ok !== false };
}

/**
 * Sign in, sharing a single attempt across concurrent callers.
 *
 * The promise is cleared once it settles, so a later retry genuinely retries rather than replaying
 * a stale failure — a cached rejection here would strand the page permanently.
 */
export function signInOnce(
  providerId: string,
  credentials: Record<string, string>
): Promise<SignInOutcome> {
  if (inFlight) return inFlight;
  inFlight = attempt(providerId, credentials).finally(() => {
    inFlight = null;
  });
  return inFlight;
}
