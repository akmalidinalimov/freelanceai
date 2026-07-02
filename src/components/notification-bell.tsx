"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** Header bell with an unread badge; polls the count every 30s. Links to /notifications. */
export function NotificationBell() {
  const t = useTranslations("Notifications");
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/notifications");
        const j = await r.json();
        if (alive && j.ok) setUnread(j.data.unread as number);
      } catch {
        /* ignore */
      }
    };
    load();
    const iv = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? t("bellUnread", { count: unread }) : t("title")}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-[hsl(var(--muted))]"
    >
      <span aria-hidden className="text-lg">🔔</span>
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[hsl(var(--primary))] px-1 text-[10px] font-bold leading-none text-[hsl(var(--primary-foreground))]">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
