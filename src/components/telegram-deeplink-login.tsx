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
 * `next` is a pre-validated locale-prefixed internal path (see login page), so the
 * visitor returns to where they were headed (e.g. the gig they wanted to order).
 */
export function TelegramDeepLinkLogin({ locale, next }: { locale: string; next?: string }) {
  const t = useTranslations("Auth");
  const [phase, setPhase] = useState<Phase>("init");
  const [deepLink, setDeepLink] = useState<string>();
  const [code, setCode] = useState<string>();
  const tokenRef = useRef<string | undefined>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const prepare = useCallback(async () => {
    setPhase("init");
    try {
      const r = await fetch("/api/auth/telegram/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const j = await r.json();
      if (j.ok) {
        tokenRef.current = j.data.token;
        setDeepLink(j.data.deepLink);
        setCode(j.data.pairingCode);
        setPhase("ready");
      } else {
        setPhase("error");
      }
    } catch {
      setPhase("error");
    }
  }, [locale]);

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
            window.location.href = next ?? `/${locale}`;
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
        {/* Telegram brand blue (#229ED9), not our orange: this button hands the user off to
            Telegram, and matching the destination is what makes it read as safe rather than as a
            third party asking for credentials. Hover/active are the brand's darker steps. */}
        <Button
          size="lg"
          className="w-full bg-[#229ED9] text-white hover:bg-[#1E8BC0] active:bg-[#1A7BA8] focus-visible:ring-[#229ED9] disabled:bg-[#229ED9]/60"
          disabled={phase === "init"}
        >
          <svg aria-hidden viewBox="0 0 24 24" className="mr-2 h-5 w-5 shrink-0 fill-current">
            <path d="M11.94 2.02c-5.5 0-9.96 4.46-9.96 9.96s4.46 9.96 9.96 9.96 9.96-4.46 9.96-9.96-4.46-9.96-9.96-9.96Zm4.64 6.79-1.55 7.33c-.12.52-.42.65-.86.4l-2.37-1.75-1.14 1.1c-.13.13-.24.24-.48.24l.17-2.42 4.4-3.98c.19-.17-.04-.27-.3-.1l-5.43 3.42-2.34-.73c-.51-.16-.52-.51.11-.76l9.13-3.52c.42-.15.79.1.66.77Z" />
          </svg>
          {phase === "init" ? t("preparing") : t("loginTelegram")}
        </Button>
      </a>

      {/* The pairing code must be on screen BEFORE the user leaves for Telegram — it is only
          protective if they saw it here first. Rendered from "ready", not just "waiting". */}
      {code && phase !== "init" && (
        <div className="flex w-full flex-col items-center gap-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-center">
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{t("pairingCodeLabel")}</span>
          <span className="font-mono text-2xl font-bold tracking-[0.2em] tabular-nums">{code}</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{t("pairingCodeHint")}</span>
        </div>
      )}

      {phase === "waiting" && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("waiting")}</p>
          {deepLink && (
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[hsl(var(--primary-ink))] underline"
            >
              {t("openInTelegram")}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
