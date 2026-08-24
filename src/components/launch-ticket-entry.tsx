"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";

/**
 * Spends a bot-issued launch ticket, then leaves.
 *
 * Done client-side deliberately: it reuses the exact signIn() path the Mini App bootstrap already
 * proves works in Telegram's WebView, rather than introducing a second, differently-behaving
 * server-side sign-in for the one flow we least want to be fragile.
 *
 * The ticket is stripped from the address with replaceState BEFORE sign-in resolves, so a spent
 * token never sits in a URL the user could copy or a screenshot could leak.
 */
export function LaunchTicketEntry() {
  const t = useTranslations("Auth");
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // StrictMode double-invoke would spend the ticket twice
    ran.current = true;

    const url = new URL(window.location.href);
    const token = url.searchParams.get("tkt") ?? "";
    const rawNext = url.searchParams.get("next") ?? "";
    // Only ever follow a same-site path — never "//evil.com", which is protocol-relative.
    const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

    url.searchParams.delete("tkt");
    window.history.replaceState(null, "", url.toString());

    if (!token) {
      window.location.replace("/login");
      return;
    }

    void (async () => {
      const res = await signIn("telegram-ticket", { token, redirect: false }).catch(() => null);
      if (res?.ok && !res.error) {
        // A full load, not router.push: the session cookie must be attached by the server on the
        // next request, and this guarantees that rather than relying on a client cache refresh.
        window.location.replace(next);
        return;
      }
      // Expired, already spent, or forwarded to someone else. Fall back to normal login rather
      // than stranding the user on a spinner.
      setFailed(true);
      setTimeout(() => window.location.replace(`/login?next=${encodeURIComponent(next)}`), 1200);
    })();
  }, []);

  return (
    <div className="grid min-h-[60vh] place-items-center px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        {!failed && (
          <span
            aria-hidden
            className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent"
          />
        )}
        <p className="text-sm font-medium">{failed ? t("miniAppSigningIn") : t("miniAppSigningIn")}</p>
      </div>
    </div>
  );
}
