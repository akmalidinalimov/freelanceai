"use client";

import { useEffect, useRef } from "react";

/**
 * Renders the official Telegram Login Widget by injecting its script.
 * The widget redirects to `data-auth-url` (our /api/auth/telegram) on success.
 *
 * Requirements:
 *  - NEXT_PUBLIC_TELEGRAM_BOT_USERNAME must be set.
 *  - The widget only works on the public domain registered with @BotFather
 *    (/setdomain). It will not function on localhost.
 */
export function TelegramLoginButton({
  authUrl,
  botUsername,
}: {
  authUrl: string;
  botUsername?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !botUsername) return;
    // Avoid double-injection on re-render.
    if (ref.current.querySelector("script")) return;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-auth-url", authUrl);
    script.setAttribute("data-request-access", "write");
    ref.current.appendChild(script);
  }, [authUrl, botUsername]);

  if (!botUsername) {
    return (
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Telegram bot is not configured yet
        (NEXT_PUBLIC_TELEGRAM_BOT_USERNAME).
      </p>
    );
  }

  return <div ref={ref} />;
}
