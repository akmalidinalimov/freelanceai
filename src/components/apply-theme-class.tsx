"use client";

import { useEffect } from "react";

/**
 * Adds a theme class to <html> for the lifetime of the mounting page, then removes it on
 * navigate-away. Used by the homepage to extend the D02 dark palette to the shared chrome
 * (header / footer / bottom-nav) that lives outside the page's own wrapper — those are
 * token-based, so the class alone re-themes them. The page content itself already carries
 * the class server-side (no flash there); this only re-themes the surrounding chrome.
 */
export function ApplyThemeClass({ name }: { name: string }) {
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add(name);
    return () => el.classList.remove(name);
  }, [name]);
  return null;
}
