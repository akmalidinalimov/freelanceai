"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatUzs } from "@/lib/utils";

/** Seller-facing: request a withdrawal of the available balance. */
export function PayoutRequestButton({ availableUzs }: { availableUzs: number }) {
  const t = useTranslations("Payout");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (availableUzs <= 0) return null;

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/me/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const j = await r.json();
      if (j.ok) setDone(true);
      else {
        setError(j.error?.message ?? t("error"));
        setBusy(false);
      }
    } catch {
      setError(t("error"));
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-4">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("available")}</p>
      <p className="mb-2 text-xl font-bold tabular-nums">{formatUzs(availableUzs)} so&apos;m</p>
      {done ? (
        <p className="text-sm font-medium text-green-600">{t("requested")}</p>
      ) : (
        <Button size="sm" onClick={go} disabled={busy}>
          {t("request")}
        </Button>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
