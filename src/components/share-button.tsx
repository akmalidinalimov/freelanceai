"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * "Made with Gigora" share loop: one-tap Telegram share + copy-link on public content
 * (gigs, profiles, delivered results). The link carries the sharer's referral code so
 * every share also drives referral attribution. `path` is a locale-prefixed internal path.
 */
export function ShareButton({ path, title }: { path: string; title: string }) {
  const t = useTranslations("Share");
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referral/me")
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) setCode(j.data?.code ?? null);
      })
      .catch(() => {});
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}${path}${code ? `?ref=${code}` : ""}`;
  const text = t("shareText", { title });
  const tgHref = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  const btn =
    "inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--input-border))] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))]";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={tgHref}
        target="_blank"
        rel="noreferrer"
        className={btn}
        aria-label={t("shareTelegram")}
      >
        <span aria-hidden>✈️</span> {t("telegram")}
      </a>
      <button type="button" onClick={copy} className={btn} aria-label={t("copyLink")}>
        <span aria-hidden>🔗</span> {copied ? t("copied") : t("copyLink")}
      </button>
    </div>
  );
}
