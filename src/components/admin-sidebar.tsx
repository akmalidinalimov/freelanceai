"use client";

import { Link, usePathname } from "@/i18n/navigation";

export interface AdminNavItem {
  href: string;
  label: string;
  /** Live queue size — the number an admin needs to act on. */
  badge?: number;
}
export interface AdminNavGroup {
  heading: string;
  items: AdminNavItem[];
}

/**
 * Persistent admin navigation (LMS-style shell): grouped sidebar on desktop,
 * horizontally scrollable chip bar on phones. Queue badges surface work that's
 * waiting (moderation, seller approval, KYC, disputes, payouts).
 */
export function AdminSidebar({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const badge = (n?: number) =>
    n && n > 0 ? (
      <span className="ml-auto rounded-full bg-[hsl(var(--warning))]/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[hsl(var(--warning))]">
        {n}
      </span>
    ) : null;

  return (
    <>
      {/* Desktop: sticky grouped sidebar */}
      <nav
        aria-label="Admin"
        className="sticky top-20 hidden max-h-[calc(100vh-6rem)] w-52 shrink-0 self-start overflow-y-auto pr-2 lg:block"
      >
        {groups.map((g) => (
          <div key={g.heading} className="mb-5">
            <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              {g.heading}
            </p>
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                      isActive(it.href)
                        ? "bg-[hsl(var(--primary))]/10 font-semibold text-[hsl(var(--primary-ink))]"
                        : "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                    }`}
                  >
                    <span className="truncate">{it.label}</span>
                    {badge(it.badge)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Mobile: scrollable chip bar (the sidebar content, flattened) */}
      <nav aria-label="Admin" className="-mx-4 mb-4 overflow-x-auto px-4 lg:hidden">
        <div className="flex w-max gap-1.5 pb-1">
          {groups.flatMap((g) => g.items).map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium ${
                isActive(it.href)
                  ? "border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "border-[hsl(var(--border))] text-[hsl(var(--foreground))]"
              }`}
            >
              {it.label}
              {it.badge && it.badge > 0 ? <span className="font-bold">·{it.badge}</span> : null}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
