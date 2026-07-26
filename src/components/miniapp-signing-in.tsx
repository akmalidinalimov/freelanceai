"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Shown on the login page when it is opened INSIDE Telegram: the Mini App bootstrap
 * is authenticating from initData a moment later, so the login options would only
 * flash and confuse. Covers them with a "signing you in" state instead. If the
 * automatic sign-in doesn't land within a few seconds, the normal login options are
 * revealed so the user is never stuck behind a spinner.
 */
export function MiniAppSigningIn() {
  const t = useTranslations("Auth");
  const [state, setState] = useState<"none" | "signing" | "gaveup">("none");

  useEffect(() => {
    // Poll briefly: telegram-web-app.js may load just after this mounts.
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      if (window.Telegram?.WebApp?.initData) {
        setState("signing");
        clearInterval(id);
        // If the bridge hasn't navigated/refreshed us by then, show the manual options.
        setTimeout(() => setState("gaveup"), 6000);
      } else if (tries > 8) {
        clearInterval(id); // not in Telegram — leave the page alone
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  if (state !== "signing") return null;

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-[hsl(var(--background))]/95">
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent"
        />
        <p className="text-sm font-medium">{t("miniAppSigningIn")}</p>
      </div>
    </div>
  );
}
