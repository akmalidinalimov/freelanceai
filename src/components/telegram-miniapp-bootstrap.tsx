"use client";

import Script from "next/script";
import { useCallback, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

/**
 * Telegram Mini App bootstrap. When gigora.ai is opened as a Mini App INSIDE Telegram,
 * telegram-web-app.js exposes `window.Telegram.WebApp.initData` — a signed identity.
 * We hand it to the `telegram-miniapp` Credentials bridge (verified server-side against
 * the bot token) to establish a session with NO password. Outside Telegram (normal web),
 * `initData` is empty and this no-ops. Also calls ready()/expand() for the app-like frame.
 *
 * Two things this has to get right, both learned from the WebView behaving unlike a
 * normal browser:
 *  1. Skip signing in only when a session REALLY exists (ask /api/auth/session). An
 *     optimistic "already authed" flag used to stick around after the cookie was gone,
 *     which left the user staring at the login page for the rest of the launch.
 *  2. Land where the user was going. A protected page bounces to /login?next=… before
 *     any client code runs, so after authenticating we follow `next` instead of
 *     dropping the user on the home page.
 */
declare global {
  interface Window {
    Telegram?: {
      WebApp?: { initData?: string; ready?: () => void; expand?: () => void };
    };
  }
}

/** True when the browser currently holds a real Auth.js session. */
async function hasSession(): Promise<boolean> {
  try {
    const r = await fetch("/api/auth/session", { cache: "no-store" });
    const j = await r.json();
    return Boolean(j?.user?.id);
  } catch {
    return false;
  }
}

export function TelegramMiniAppBootstrap() {
  const router = useRouter();
  const running = useRef(false);

  const init = useCallback(async () => {
    const wa = window.Telegram?.WebApp;
    if (!wa) return;
    wa.ready?.();
    wa.expand?.();
    const initData = wa.initData;
    if (!initData) return; // opened outside Telegram — nothing to do
    if (running.current) return; // guard against onReady+onLoad both firing
    running.current = true;

    try {
      // Already signed in (cookie survived from an earlier launch) → nothing to do.
      if (await hasSession()) return;

      const res = await signIn("telegram-miniapp", { initData, redirect: false }).catch(() => null);
      if (!res?.ok || res.error) return; // stale/replayed initData — leave the login UI up

      // Follow the destination the guard preserved, else re-render as logged-in.
      const next = new URLSearchParams(window.location.search).get("next");
      if (next && next.startsWith("/") && !next.startsWith("//")) {
        window.location.href = next;
        return;
      }
      router.refresh();
    } finally {
      running.current = false;
    }
  }, [router]);

  const run = () => {
    void init();
  };
  return (
    <Script
      src="https://telegram.org/js/telegram-web-app.js"
      strategy="afterInteractive"
      onReady={run}
      onLoad={run}
    />
  );
}
