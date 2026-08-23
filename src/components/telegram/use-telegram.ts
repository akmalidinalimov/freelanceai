"use client";

import { useCallback, useMemo } from "react";

/**
 * The ONE place that touches window.Telegram.WebApp.
 *
 * Telegram's API is versioned per client build and older clients THROW on methods they do not
 * implement — the most common way Mini Apps break in the field. Every call here is therefore
 * capability-checked and degrades to a no-op, so a five-year-old Android client renders the app
 * instead of a blank screen.
 *
 * Version checks delegate to Telegram's own `isVersionAtLeast()` rather than comparing version
 * strings ourselves; it is documented, already correct, and handles their numbering quirks.
 */

type BackButton = { show?: () => void; hide?: () => void; onClick?: (cb: () => void) => void; offClick?: (cb: () => void) => void };

export interface TelegramWebApp {
  initData?: string;
  version?: string;
  ready?: () => void;
  expand?: () => void;
  isVersionAtLeast?: (v: string) => boolean;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  setBottomBarColor?: (c: string) => void;
  onEvent?: (e: string, cb: () => void) => void;
  offEvent?: (e: string, cb: () => void) => void;
  viewportStableHeight?: number;
  BackButton?: BackButton;
  HapticFeedback?: { impactOccurred?: (s: string) => void; notificationOccurred?: (t: string) => void };
  openTelegramLink?: (url: string) => void;
}

/** Never read `window` at module scope — this module is imported by server-rendered trees. */
export function getWebApp(): TelegramWebApp | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
}

/**
 * Authoritative "are we inside Telegram" check. A stubbed SDK with no initData (which is what a
 * plain browser sees once telegram-web-app.js loads) is NOT the Mini App — the signed initData is
 * the only thing Telegram gives exclusively to a real Mini App launch.
 */
export function inTelegram(): boolean {
  const wa = getWebApp();
  return Boolean(wa && typeof wa.initData === "string" && wa.initData.length > 0);
}

export function useTelegram() {
  const available = inTelegram();

  const atLeast = useCallback((version: string): boolean => {
    const wa = getWebApp();
    if (!wa) return false;
    // No isVersionAtLeast means a client older than 6.0 — assume nothing is supported.
    if (typeof wa.isVersionAtLeast !== "function") return false;
    try {
      return wa.isVersionAtLeast(version);
    } catch {
      return false;
    }
  }, []);

  /** Run `fn` only when we are in Telegram on a new enough client. Swallows client-side throws. */
  const guarded = useCallback(
    (minVersion: string, fn: (wa: TelegramWebApp) => void) => {
      const wa = getWebApp();
      if (!wa || !inTelegram() || !atLeast(minVersion)) return;
      try {
        fn(wa);
      } catch {
        /* an implemented-but-broken method must not take the page down */
      }
    },
    [atLeast]
  );

  return useMemo(
    () => ({
      available,
      atLeast,
      /** ready() + expand(): safe on every version that has a WebApp object at all. */
      init: () => {
        const wa = getWebApp();
        if (!wa || !inTelegram()) return;
        try {
          wa.ready?.();
          wa.expand?.();
        } catch {
          /* ignore */
        }
      },
      /** Paint Telegram's own frame in our colours so a dark-mode user sees no mismatched seam. */
      setFrameColors: (color: string) =>
        guarded("6.1", (wa) => {
          wa.setHeaderColor?.(color);
          wa.setBackgroundColor?.(color);
          // setBottomBarColor is 7.10+; guarded separately so 6.1 clients still get the header.
          if (atLeast("7.10")) wa.setBottomBarColor?.(color);
        }),
      haptic: (style: "light" | "medium" | "heavy" = "light") =>
        guarded("6.1", (wa) => wa.HapticFeedback?.impactOccurred?.(style)),
      backButton: {
        show: () => guarded("6.1", (wa) => wa.BackButton?.show?.()),
        hide: () => guarded("6.1", (wa) => wa.BackButton?.hide?.()),
        onClick: (cb: () => void) => guarded("6.1", (wa) => wa.BackButton?.onClick?.(cb)),
        offClick: (cb: () => void) => guarded("6.1", (wa) => wa.BackButton?.offClick?.(cb)),
      },
      /** Subscribe to a Telegram event; returns an unsubscribe that is safe to call always. */
      onEvent: (event: string, cb: () => void): (() => void) => {
        const wa = getWebApp();
        if (!wa || !inTelegram() || typeof wa.onEvent !== "function") return () => {};
        try {
          wa.onEvent(event, cb);
        } catch {
          return () => {};
        }
        return () => {
          try {
            wa.offEvent?.(event, cb);
          } catch {
            /* ignore */
          }
        };
      },
      viewportStableHeight: () => getWebApp()?.viewportStableHeight,

      /**
       * Hand the user to a t.me link — used to send /start to the bot when signing in from the
       * signed initData is not possible. Bot API 6.1+; returns false when unavailable so the
       * caller can fall back to a real anchor, which is the only thing that works on clients old
       * enough to block programmatic navigation.
       */
      openTelegramLink: (url: string): boolean => {
        const wa = getWebApp();
        if (!wa || !inTelegram() || !atLeast("6.1") || typeof wa.openTelegramLink !== "function") {
          return false;
        }
        try {
          wa.openTelegramLink(url);
          return true;
        } catch {
          return false;
        }
      },

      /**
       * The user's own name and photo, parsed from initData for DISPLAY ONLY.
       *
       * Deliberately unverified: the server re-checks the HMAC before trusting any of it. Using it
       * for pixels costs nothing and turns an anonymous spinner into "Gigora knows who I am",
       * which is the difference between waiting and worrying.
       */
      initDataUser: (): { name?: string; photoUrl?: string } | null => {
        const raw = getWebApp()?.initData;
        if (!raw) return null;
        try {
          const u = JSON.parse(new URLSearchParams(raw).get("user") ?? "{}");
          const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username;
          return { name: name || undefined, photoUrl: u.photo_url || undefined };
        } catch {
          return null;
        }
      },
    }),
    [available, atLeast, guarded]
  );
}
