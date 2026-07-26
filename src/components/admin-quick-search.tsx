"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

interface Hit {
  id: string;
  label: string;
  sub: string;
  href?: string;
}
interface Results {
  users: Hit[];
  gigs: Hit[];
  orders: Hit[];
}

/** Topbar jump box: type 2+ chars, get users/gigs/orders, click to open the record. */
export function AdminQuickSearch() {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setRes(null);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/search?q=${encodeURIComponent(q.trim())}`);
        const j = await r.json();
        if (j.ok) {
          setRes(j.data);
          setOpen(true);
        }
      } catch {
        /* transient — next keystroke retries */
      }
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  // Close on outside click / Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const section = (title: string, hits: Hit[], hrefOf: (h: Hit) => string) =>
    hits.length > 0 && (
      <div key={title}>
        <p className="px-3 pt-2 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {title}
        </p>
        {hits.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => go(hrefOf(h))}
            className="flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-[hsl(var(--muted))]"
          >
            <span className="min-w-0 truncate">{h.label}</span>
            <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">{h.sub}</span>
          </button>
        ))}
      </div>
    );

  const empty = res && res.users.length === 0 && res.gigs.length === 0 && res.orders.length === 0;

  return (
    <div ref={boxRef} className="relative mb-4 max-w-md">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => res && setOpen(true)}
        placeholder={t("quickSearchPh")}
        aria-label={t("quickSearchPh")}
        className="h-10 w-full rounded-xl border border-[hsl(var(--input-border))] bg-[hsl(var(--card))] px-3 text-sm shadow-[var(--shadow-soft)]"
      />
      {open && res && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] pb-2 shadow-[var(--shadow-overlay)]">
          {empty ? (
            <p className="px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">{t("quickSearchNone")}</p>
          ) : (
            <>
              {section(t("users"), res.users, (h) => `/admin/users/${h.id}`)}
              {section(t("quickGigs"), res.gigs, (h) => h.href ?? "/admin/moderation")}
              {section(t("quickOrders"), res.orders, (h) => `/orders/${h.id}`)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
