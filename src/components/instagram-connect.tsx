"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";

const IG_GRADIENT = "linear-gradient(45deg,#f7b24a,#f0623c,#c13584,#5b4ad0)";

/**
 * Instagram connect/disconnect controls on the seller profile editor.
 * Backend: GET /api/instagram/connect (redirect flow, returns with ?ig=marker),
 * POST /api/instagram/disconnect. See UI-REQUESTS.md task 2.
 */
export function InstagramConnect({
  connected,
  handle,
  syncedAt,
  marker,
}: {
  connected: boolean;
  handle: string | null;
  /** ISO timestamp of the last successful sync, if any. */
  syncedAt: string | null;
  /** `?ig=` return marker from the OAuth redirect: connected | error | unavailable. */
  marker?: string;
}) {
  const t = useTranslations("Instagram");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markerText =
    marker === "connected"
      ? t("markerConnected")
      : marker === "error"
        ? t("markerError")
        : marker === "unavailable"
          ? t("markerUnavailable")
          : null;
  const markerTone =
    marker === "connected"
      ? "border-green-300 bg-green-50 text-green-800"
      : "border-amber-300 bg-amber-50 text-amber-800";

  async function disconnect() {
    if (!window.confirm(t("disconnectWarn"))) return;
    setBusy(true);
    setError(null);
    const r = await fetch("/api/instagram/disconnect", { method: "POST" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) {
      window.location.href = window.location.pathname; // drop ?ig= and refresh state
      return;
    }
    setBusy(false);
    setError(j?.error?.message ?? t("markerError"));
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-4">
      {markerText && (
        <p className={`mb-3 rounded-md border px-3 py-2 text-sm ${markerTone}`}>{markerText}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-4 w-4 rounded"
            style={{ background: IG_GRADIENT }}
          />
          <span>
            <span className="font-medium">Instagram</span>
            {connected && handle ? (
              <span className="block text-sm text-[hsl(var(--muted-foreground))]">
                @{handle} · {t("connected")}
                {syncedAt && (
                  <>
                    {" "}
                    · {t("lastSynced")}: {new Date(syncedAt).toLocaleDateString(locale)}
                  </>
                )}
              </span>
            ) : (
              <span className="block text-sm text-[hsl(var(--muted-foreground))]">
                {t("connectHint")}
              </span>
            )}
          </span>
        </span>
        {connected ? (
          <Button size="sm" variant="outline" onClick={disconnect} disabled={busy}>
            {busy ? "…" : t("disconnect")}
          </Button>
        ) : (
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- API route handler (OAuth redirect): requires a full-page navigation, not client routing
          <a
            href="/api/instagram/connect"
            className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-white"
            style={{ background: IG_GRADIENT }}
          >
            {t("connect")}
          </a>
        )}
      </div>
      {error && (
        <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
