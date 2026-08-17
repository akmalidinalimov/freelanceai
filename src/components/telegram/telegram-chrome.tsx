"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTelegram, inTelegram } from "@/components/telegram/use-telegram";
import { isRootPath, MINIAPP_COOKIE } from "@/lib/miniapp";

/** Sandstone Weave — the `--background` token, as a literal because Telegram needs a hex. */
const FRAME_COLOR = "#f3f1ec";

/**
 * Telegram's own chrome, and the correction that keeps the marker honest.
 *
 * Mounted once in the locale layout. Does nothing at all outside Telegram.
 *
 *   markerActive=true, SDK present  ->  drive BackButton / frame / viewport
 *   markerActive=true, SDK absent   ->  the marker LIED (stale cookie, or a ?tgapp=1 URL that
 *                                       someone copied and shared). Clear it and re-render, or the
 *                                       user sits on a page with no header, no bottom nav and no
 *                                       Telegram back button — nothing to navigate with.
 *   markerActive=false, SDK present ->  a Mini App launch that missed the param; nothing to undo
 *                                       here, the chrome simply stays until the next navigation
 *                                       carries the cookie.
 *
 * See docs/superpowers/specs/2026-08-11-telegram-miniapp-shell-design.md §1.
 */

/** Module-scoped so even a remount cannot turn the correction into a refresh loop. */
let correctionAttempted = false;

export function TelegramChrome({ markerActive }: { markerActive: boolean }) {
  const tg = useTelegram();
  const router = useRouter();
  const pathname = usePathname();
  const correcting = useRef(false);

  // --- The correction. Runs before anything else touches the SDK. ---
  useEffect(() => {
    if (!markerActive || inTelegram() || correctionAttempted) return;
    correctionAttempted = true;
    correcting.current = true;
    // Expire the cookie, then ask the server to re-render. Middleware strips the query param on
    // its way in, so nothing re-sets the marker and this cannot loop.
    document.cookie = `${MINIAPP_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
    router.refresh();
  }, [markerActive, router]);

  // --- Launch: ready/expand, and paint Telegram's frame in our sand. ---
  useEffect(() => {
    if (!tg.available) return;
    tg.init();
    tg.setFrameColors(FRAME_COLOR);
  }, [tg]);

  // --- Keyboard-aware viewport. Bound to Telegram's own event, NOT window resize: resize fires
  //     continuously while the keyboard animates and would thrash the variable. ---
  useEffect(() => {
    if (!tg.available) return;
    const apply = () => {
      const h = tg.viewportStableHeight();
      if (typeof h === "number" && h > 0) {
        document.documentElement.style.setProperty("--tg-viewport", `${h}px`);
      }
    };
    apply();
    return tg.onEvent("viewportChanged", apply);
  }, [tg]);

  // --- BackButton: Telegram's native back, hidden on root screens where there is nowhere to go. ---
  useEffect(() => {
    if (!tg.available) return;
    const onBack = () => router.back();
    tg.backButton.onClick(onBack);
    if (isRootPath(pathname)) tg.backButton.hide();
    else tg.backButton.show();
    return () => tg.backButton.offClick(onBack);
  }, [tg, pathname, router]);

  return null;
}
