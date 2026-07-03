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
 */
declare global {
  interface Window {
    Telegram?: {
      WebApp?: { initData?: string; ready?: () => void; expand?: () => void };
    };
  }
}

export function TelegramMiniAppBootstrap() {
  const router = useRouter();
  const done = useRef(false);

  const init = useCallback(async () => {
    const wa = window.Telegram?.WebApp;
    if (!wa) return;
    wa.ready?.();
    wa.expand?.();
    const initData = wa.initData;
    if (!initData) return; // opened outside Telegram — nothing to do
    // Once per Mini App session: sessionStorage survives full reloads within the
    // WebView; the ref covers client-side (SPA) navigations. Avoids re-signing an
    // already-authenticated user on every open.
    if (done.current) return;
    done.current = true;
    try {
      if (sessionStorage.getItem("tg_miniapp_authed") === "1") return;
    } catch {
      /* private mode — proceed */
    }
    const res = await signIn("telegram-miniapp", { initData, redirect: false }).catch(() => null);
    if (res?.ok && !res.error) {
      try {
        sessionStorage.setItem("tg_miniapp_authed", "1");
      } catch {
        /* ignore */
      }
      router.refresh(); // re-render server components as logged-in
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
