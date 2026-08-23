"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useTelegram, inTelegram, getWebApp } from "@/components/telegram/use-telegram";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

/**
 * Sign-in inside Telegram. One component, one state machine, no confirmation code.
 *
 * It replaces a design where two components independently guessed at the same thing: one polled
 * for initData then blind-waited six seconds, while the other performed the actual sign-in and
 * reported nothing when it failed. Neither could observe the other, so a failure appeared as a
 * spinner that eventually uncovered a login form asking for a 4-character code — from a user
 * Telegram had already identified to us.
 *
 * Telegram hands the page a SIGNED payload naming the user. That is the credential; we spend it
 * directly and never leave the app. Sending /start to the bot is the fallback, reached only when
 * the server rejects that payload.
 *
 * Two hard rules, both from the reported failure: no indicator lasts past ~3s without a visible
 * way out, and every terminal state can still browse — being signed out must never trap anyone.
 */
type State = "detecting" | "authenticating" | "success" | "manual" | "botWaiting" | "web";

const DETECT_STEP_MS = 150;
const DETECT_MS = 1200;
const SLOW_HINT_MS = 3000;
const BOT_WAIT_MS = 90_000;

export function TelegramAuthGate({
  next,
  botUsername,
  browseHref,
  /**
   * What the SERVER already concluded from the request. This decides the first paint, and it
   * matters twice over: a web visitor must get the real login options in the server HTML (no-JS,
   * crawlers, and first paint all depend on it — a deploy check caught this by noticing the email
   * form had vanished), while a Telegram user must NOT see those options flash before the gate
   * takes over. Client detection then confirms or corrects it.
   */
  serverSaysMiniApp = false,
  children,
}: {
  next?: string;
  botUsername?: string;
  browseHref: string;
  serverSaysMiniApp?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("Auth");
  const tg = useTelegram();
  const [state, setState] = useState<State>(serverSaysMiniApp ? "detecting" : "web");
  const [slow, setSlow] = useState(false);
  const [who, setWho] = useState<{ name?: string; photoUrl?: string } | null>(null);
  const started = useRef(false);

  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : browseHref;

  const attempt = useCallback(async () => {
    const initData = getWebApp()?.initData ?? "";
    if (!initData) {
      setState("web");
      return;
    }
    setWho(tg.initDataUser());
    setState("authenticating");

    // Already signed in from an earlier launch? Then there is nothing to do but leave.
    try {
      const s = await fetch("/api/auth/session", { cache: "no-store" }).then((r) => r.json());
      if (s?.user?.id) {
        setState("success");
        window.location.replace(dest);
        return;
      }
    } catch {
      /* fall through and try to sign in */
    }

    const res = await signIn("telegram-miniapp", { initData, redirect: false }).catch(() => null);
    if (res?.ok && !res.error) {
      setState("success");
      // A full load, not a client transition: the session cookie must be attached by the server on
      // the next request for the destination to render as signed in.
      window.location.replace(dest);
      return;
    }
    setState("manual");
  }, [dest, tg]);

  // Telegram's script is injected by the bootstrap and can land after we mount, so poll briefly
  // instead of deciding on first paint.
  useEffect(() => {
    if (started.current) return;
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      if (inTelegram()) {
        clearInterval(id);
        started.current = true;
        void attempt();
      } else if (tries * DETECT_STEP_MS >= DETECT_MS) {
        // Not Telegram after all: show the ordinary options rather than a spinner.
        clearInterval(id);
        started.current = true;
        setState("web");
      }
    }, DETECT_STEP_MS);
    return () => clearInterval(id);
  }, [attempt]);

  useEffect(() => {
    if (state !== "authenticating") return;
    const id = setTimeout(() => setSlow(true), SLOW_HINT_MS);
    return () => clearTimeout(id);
  }, [state]);

  // Returning from the bot chat: re-check the moment the app is visible again, rather than making
  // the user wait out a timer on a screen that looks stuck.
  useEffect(() => {
    if (state !== "botWaiting") return;
    const recheck = async () => {
      const s = await fetch("/api/auth/session", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null);
      if (s?.user?.id) window.location.replace(dest);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void recheck();
    };
    document.addEventListener("visibilitychange", onVisible);
    const offResume = tg.onEvent("viewportChanged", () => void recheck());
    const poll = setInterval(recheck, 2000);
    const stop = setTimeout(() => clearInterval(poll), BOT_WAIT_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      offResume();
      clearInterval(poll);
      clearTimeout(stop);
    };
  }, [state, dest, tg]);

  const openBot = () => {
    tg.haptic("light");
    const url = `https://t.me/${botUsername}?start=app`;
    // Render the waiting screen BEFORE navigating. If the WebView survives the switch, the user
    // returns to something already working rather than to a button they will press a second time.
    setState("botWaiting");
    if (!tg.openTelegramLink(url)) window.open(url, "_self");
  };

  const retry = () => {
    setSlow(false);
    started.current = true;
    void attempt();
  };

  if (state === "web") return <>{children}</>;

  const shell = (body: React.ReactNode) => (
    <div className="grid min-h-[60vh] place-items-center px-6">
      <div className="flex w-full max-w-xs flex-col items-center gap-4 text-center">{body}</div>
    </div>
  );

  const face = who ? <Avatar src={who.photoUrl} name={who.name ?? "?"} size="lg" /> : null;
  const browse = (
    <a href={browseHref} className="text-sm text-[hsl(var(--muted-foreground))] underline">
      {t("tgBrowseGuest")}
    </a>
  );

  if (state === "detecting" || state === "authenticating" || state === "success") {
    return shell(
      <>
        {face}
        <span
          aria-hidden
          className="h-7 w-7 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent"
        />
        <p className="text-sm font-medium" role="status">
          {state === "success"
            ? t("tgSuccess", { name: who?.name ?? "" })
            : who?.name
              ? t("tgSigningInNamed", { name: who.name })
              : t("miniAppSigningIn")}
        </p>
        {slow && state === "authenticating" && (
          <button
            type="button"
            onClick={() => setState("manual")}
            className="text-sm text-[hsl(var(--muted-foreground))] underline"
          >
            {t("tgSlowHint")}
          </button>
        )}
      </>
    );
  }

  if (state === "botWaiting") {
    return shell(
      <>
        {face}
        <p className="text-base font-semibold">{t("tgBotWaitTitle")}</p>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t("tgBotWaitBody", { bot: botUsername ?? "" })}
        </p>
        <Button className="w-full" onClick={retry}>
          {t("tgImBack")}
        </Button>
        {browse}
      </>
    );
  }

  return shell(
    <>
      {face}
      <p className="text-base font-semibold">{t("tgManualTitle")}</p>
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("tgManualBody")}</p>
      {botUsername && (
        <Button
          className="w-full bg-[#229ED9] text-white hover:bg-[#1E8BC0] active:bg-[#1A7BA8]"
          onClick={openBot}
        >
          {t("tgOpenBot")}
        </Button>
      )}
      <button type="button" onClick={retry} className="text-sm underline">
        {t("tgRetry")}
      </button>
      {browse}
    </>
  );
}
