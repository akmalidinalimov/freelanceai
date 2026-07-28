"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const DISMISS_KEY = "gigora_bot_reconnect_dismissed";

/**
 * One-time nudge for users linked to the OLD Telegram bot: the new bot can't message
 * them until they open it. Server decides whether to render this at all (needsBotReconnect);
 * dismissal is session-scoped so it re-nudges next visit until they actually reconnect
 * (at which point the server stops rendering it).
 */
export function BotReconnectBanner({ deepLink, botName }: { deepLink: string; botName: string }) {
  const t = useTranslations("BotMigration");
  // Render only after mount so the session-storage check can't cause a hydration mismatch.
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(sessionStorage.getItem(DISMISS_KEY) !== "1");
  }, []);
  if (!show) return null;

  return (
    <div
      role="region"
      aria-label={t("aria")}
      className="border-b border-[hsl(var(--border))] bg-[hsl(var(--primary))]/8"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-sm">
        <span aria-hidden className="shrink-0 text-base">🔔</span>
        <p className="flex-1 text-[hsl(var(--foreground))]">{t("text")}</p>
        <a
          href={deepLink}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-md bg-[hsl(var(--primary))] px-3 py-1 text-xs font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90"
        >
          {t("cta", { bot: botName })}
        </a>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, "1");
            setShow(false);
          }}
          aria-label={t("dismiss")}
          className="shrink-0 rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
