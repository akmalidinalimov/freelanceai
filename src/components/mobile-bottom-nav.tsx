"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

const ITEMS = [
  { href: "/", key: "home", icon: "⌂" },
  { href: "/search", key: "search", icon: "🔍" },
  { href: "/gigs", key: "explore", icon: "▦" },
  { href: "/creators", key: "creators", icon: "✦" },
] as const;

/** Thumb-reachable bottom tab bar for mobile (hidden on md+). */
export function MobileBottomNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {ITEMS.map((it) => {
        const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${
              active ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"
            }`}
          >
            <span className="text-lg" aria-hidden>
              {it.icon}
            </span>
            {t(it.key)}
          </Link>
        );
      })}
    </nav>
  );
}
