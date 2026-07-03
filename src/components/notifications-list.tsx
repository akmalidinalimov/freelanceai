"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Relative-time parts; the caller formats with its localized `t` so labels are per-locale. */
function agoParts(iso: string): { n: number | null; unit: "now" | "minShort" | "hourShort" | "dayShort" } {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return { n: null, unit: "now" };
  if (s < 3600) return { n: Math.floor(s / 60), unit: "minShort" };
  if (s < 86400) return { n: Math.floor(s / 3600), unit: "hourShort" };
  return { n: Math.floor(s / 86400), unit: "dayShort" };
}

export function NotificationsList({ initial }: { initial: NotificationItem[] }) {
  const t = useTranslations("Notifications");
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  // Relative time depends on the current clock, which differs between SSR and hydration —
  // render it only after mount (client-only) to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch("/api/notifications/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      /* ignore — optimistic UI already updated */
    } finally {
      setBusy(false);
    }
  }

  function removeOne(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
    void post({ id });
  }

  function clearAll() {
    setItems([]);
    void post({});
  }

  if (items.length === 0) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("empty")}</p>;
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button onClick={clearAll} disabled={busy} className="text-sm text-[hsl(var(--muted-foreground))] hover:underline disabled:opacity-50">
          {t("clearAll")}
        </button>
      </div>
      <ul aria-live="polite" className="divide-y divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        {items.map((n) => {
          const inner = (
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className={n.readAt ? "font-medium" : "font-semibold"}>{n.title}</p>
                {n.body && <p className="truncate text-sm text-[hsl(var(--muted-foreground))]">{n.body}</p>}
              </div>
              <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">
                {mounted
                  ? (() => {
                      const p = agoParts(n.createdAt);
                      return p.n === null ? t("now") : `${p.n} ${t(p.unit)}`;
                    })()
                  : ""}
              </span>
            </div>
          );
          return (
            <li key={n.id} className={`flex items-center ${n.readAt ? "" : "bg-[hsl(var(--muted))]/30"}`}>
              <div className="min-w-0 flex-1">
                {n.link ? (
                  <Link href={n.link} className="block hover:bg-[hsl(var(--muted))]/40">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </div>
              <button
                onClick={() => removeOne(n.id)}
                disabled={busy}
                aria-label={t("delete")}
                title={t("delete")}
                className="shrink-0 px-3 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--danger))] disabled:opacity-50"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
