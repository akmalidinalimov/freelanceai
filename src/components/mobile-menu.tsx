"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";

interface NavItem {
  href: string;
  label: string;
}

/** Collapsible hamburger menu for the mobile header. */
export function MobileMenu({ items, logoutLabel }: { items: NavItem[]; logoutLabel: string | null }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

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

  return (
    <div className="relative">
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
      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2 shadow-lg">
            {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]"
              >
                {it.label}
              </Link>
            ))}
            {logoutLabel && (
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[hsl(var(--muted))]"
                >
                  {logoutLabel}
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
