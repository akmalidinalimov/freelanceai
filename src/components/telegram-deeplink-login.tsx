"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

type Phase = "init" | "ready" | "waiting" | "error";

/**
 * Bot deep-link login. Fetches a one-time token on mount, opens the Telegram bot
 * deep link on click, and polls until the bot confirms — then redirects. No phone
 * number, no popup credential entry: the user just taps Start in Telegram.
 */
export function TelegramDeepLinkLogin({ locale }: { locale: string }) {
  const t = useTranslations("Auth");
  const [phase, setPhase] = useState<Phase>("init");
  const [deepLink, setDeepLink] = useState<string>();
  const tokenRef = useRef<string | undefined>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const prepare = useCallback(async () => {
    setPhase("init");
    try {
      const r = await fetch("/api/auth/telegram/start", { method: "POST" });
      const j = await r.json();
      if (j.ok) {
        tokenRef.current = j.data.token;
        setDeepLink(j.data.deepLink);
        setPhase("ready");
      } else {
        setPhase("error");
      }
    } catch {
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    prepare();
    return () => clearInterval(pollRef.current);
  }, [prepare]);

  function startPolling() {
    setPhase("waiting");
    const startedAt = Date.now();
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAt > 3 * 60 * 1000) {
        clearInterval(pollRef.current);
        setPhase("error");
        return;
      }
      try {
        const r = await fetch("/api/auth/telegram/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: tokenRef.current }),
        });
        const j = await r.json();
        if (j.ok && j.status === "confirmed") {
          clearInterval(pollRef.current);
          // Exchange the confirmed token for an Auth.js session.
          const res = await signIn("telegram", {
            token: tokenRef.current,
            redirect: false,
          });
          if (res && !res.error) {
            window.location.href = `/${locale}`;
          } else {
            setPhase("error");
          }
        } else if (j.status === "expired") {
          clearInterval(pollRef.current);
          setPhase("error");
        }
      } catch {
        /* transient; keep polling */
      }
    }, 1500);
  }

  if (phase === "error") {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("failed")}</p>
        <Button onClick={prepare}>{t("retry")}</Button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <a
        href={deepLink ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (!deepLink) {
            e.preventDefault();
            return;
          }
          startPolling();
        }}
        className="w-full"
        aria-disabled={phase === "init"}
      >
        <Button size="lg" className="w-full" disabled={phase === "init"}>
          {phase === "init" ? t("preparing") : t("loginTelegram")}
        </Button>
      </a>

      {phase === "waiting" && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("waiting")}</p>
          {deepLink && (
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[hsl(var(--primary))] underline"
            >
              {t("openInTelegram")}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
