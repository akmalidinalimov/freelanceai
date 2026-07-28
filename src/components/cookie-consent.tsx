"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * Cookie-consent banner. The analytics scripts (Clarity, Meta Pixel) self-configure
 * from the `cookieconsent` cookie at load time (see clarity-analytics.tsx / meta-pixel.tsx):
 * without a stored "granted" they stay cookieless/consent-revoked. This banner only
 * appears when NO choice has been recorded, and its buttons flip the trackers live +
 * persist the decision. Privacy-preserving default: no tracking cookies until Accept.
 */
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

const MAX_AGE = 365 * 24 * 60 * 60;

function readConsent(): "granted" | "denied" | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)cookieconsent=(granted|denied)/);
  return m ? (m[1] as "granted" | "denied") : null;
}

export function CookieConsent() {
  const t = useTranslations("Consent");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (readConsent() === null) setShow(true);
  }, []);

  if (!show) return null;

  function choose(value: "granted" | "denied") {
    document.cookie = `cookieconsent=${value}; path=/; max-age=${MAX_AGE}; samesite=lax`;
    if (value === "granted") {
      window.clarity?.("consent");
      window.fbq?.("consent", "grant");
    } else {
      window.fbq?.("consent", "revoke");
    }
    setShow(false);
  }

  return (
    <div
      role="dialog"
      aria-label={t("title")}
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[hsl(var(--foreground))]">
          {t("message")}{" "}
          <Link href="/legal/privacy" className="underline hover:text-[hsl(var(--primary-ink))]">
            {t("learnMore")}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => choose("denied")}>
            {t("decline")}
          </Button>
          <Button size="sm" onClick={() => choose("granted")}>
            {t("accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}
