"use client";

import { useEffect } from "react";

/**
 * Keeps a web session rolling from last use.
 *
 * Auth.js re-signs the session JWT whenever `/api/auth/session` is read, pushing the expiry
 * forward. The catch is that `auth()` inside a Server Component throws that refreshed cookie away
 * (next-auth/lib/index.js reads only the JSON body), and nothing on the web ever hit that route —
 * there is no SessionProvider and no useSession anywhere. So a web session expired a fixed 30 days
 * after ISSUE, however active the user was. Mini App users were already fine, because the Telegram
 * bootstrap fetches that route on every launch, which is exactly the difference this closes.
 *
 * Throttled to once per 12 hours per browser, so it costs one request per user per half-day rather
 * than one per page view. A failure is silent and harmless: the session simply is not extended
 * this time, and the next visit tries again.
 */
const KEY = "gigora.sess";
const EVERY_MS = 12 * 60 * 60 * 1000;

export function SessionKeepalive() {
  useEffect(() => {
    let last = 0;
    try {
      last = Number(window.localStorage.getItem(KEY) ?? 0);
    } catch {
      // Private mode or blocked storage: fall through and just ping. Refreshing more often than
      // needed is far better than never refreshing at all.
    }
    if (Date.now() - last < EVERY_MS) return;

    // keepalive so a refresh mid-navigation still completes.
    void fetch("/api/auth/session", { cache: "no-store", keepalive: true })
      .then(() => {
        try {
          window.localStorage.setItem(KEY, String(Date.now()));
        } catch {
          /* nothing to do — the ping already happened */
        }
      })
      .catch(() => {
        /* offline or blocked; try again next visit */
      });
  }, []);

  return null;
}
