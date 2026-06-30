"use client";

import { useState } from "react";
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

function ago(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hozir";
  if (s < 3600) return `${Math.floor(s / 60)} daq`;
  if (s < 86400) return `${Math.floor(s / 3600)} soat`;
  return `${Math.floor(s / 86400)} kun`;
}

export function NotificationsList({ initial }: { initial: NotificationItem[] }) {
  const t = useTranslations("Notifications");
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);

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
      <ul className="divide-y divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        {items.map((n) => {
          const inner = (
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className={n.readAt ? "font-medium" : "font-semibold"}>{n.title}</p>
                {n.body && <p className="truncate text-sm text-[hsl(var(--muted-foreground))]">{n.body}</p>}
              </div>
              <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">{ago(n.createdAt)}</span>
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
                className="shrink-0 px-3 text-[hsl(var(--muted-foreground))] hover:text-red-600 disabled:opacity-50"
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
