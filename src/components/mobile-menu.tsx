"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@/i18n/navigation";

interface NavItem {
  href: string;
  label: string;
}

/**
 * Hamburger menu for the mobile header, and the only route to sign in or out on a phone.
 *
 * Rendered through a PORTAL, for two reasons that both showed up as real bugs inside Telegram:
 *
 *  1. The panel used to be `absolute right-0 w-56` inside the trigger's wrapper. In the Mini App
 *     the brand mark is hidden, which left the header's `justify-between` row with a single item
 *     and packed it to the LEFT — so a 224px panel anchored to a trigger at x≈154 ran off the
 *     left edge of the screen and was unreadable.
 *  2. The click-outside scrim was `fixed inset-0`, but the header sets `backdrop-blur`, and a
 *     non-`none` backdrop-filter makes an element a containing block for fixed-position
 *     descendants. The scrim therefore covered only the 64px header strip, so tapping the page
 *     never closed the menu.
 *
 * A portal to `document.body` escapes both: the panel is positioned against the viewport, and the
 * scrim genuinely covers it. Rendered only after mount, since `document` does not exist on the
 * server.
 */
export function MobileMenu({ items, logoutLabel }: { items: NavItem[]; logoutLabel: string | null }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  // Escape closes the menu and returns focus to the trigger (keyboard a11y, WCAG 2.1.2/2.4.3).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock background scroll while open, matching media-lightbox's behaviour.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const overlay = (
    <>
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-[60] cursor-default"
      />
      {/* Clamped so it can never overhang a narrow viewport, and pinned to the right regardless of
          where the trigger ended up. */}
      <div
        role="menu"
        className="fixed right-2 top-14 z-[61] w-[min(14rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2 shadow-lg"
      >
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]"
          >
            {it.label}
          </Link>
        ))}
        {logoutLabel && (
          <form action="/api/auth/logout" method="post" className="mt-1 border-t border-[hsl(var(--border))] pt-1">
            <button
              type="submit"
              role="menuitem"
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]"
            >
              {logoutLabel}
            </button>
          </form>
        )}
      </div>
    </>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-[hsl(var(--muted))]"
      >
        <span aria-hidden className="text-xl">
          {open ? "✕" : "☰"}
        </span>
      </button>
      {open && mounted && createPortal(overlay, document.body)}
    </>
  );
}
