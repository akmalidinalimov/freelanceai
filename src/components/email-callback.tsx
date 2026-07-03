"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";

/**
 * Completes a magic-link login: hands the token to the "email-link" Credentials
 * provider (which consumes it + upserts the user), then Auth.js redirects to home.
 * On failure it falls back to the login page with an error marker.
 */
export function EmailCallback({ token, locale }: { token: string; locale: string }) {
  const t = useTranslations("Auth");
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setFailed(true);
      return;
    }
    signIn("email-link", { token, redirect: false })
      .then((res) => {
        if (res?.ok && !res.error) {
          window.location.assign(`/${locale}`);
        } else {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
  }, [token, locale]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      {failed ? (
        <>
          <p className="text-sm text-[hsl(var(--danger))]" role="alert">
            {t("emailLinkInvalid")}
          </p>
          <a href={`/${locale}/login`} className="text-sm font-medium underline">
            {t("retry")}
          </a>
        </>
      ) : (
        <p className="text-[hsl(var(--muted-foreground))]" role="status">
          {t("emailSigningIn")}
        </p>
      )}
    </div>
  );
}
