"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Action = "requestTelegramContact" | "requestTelegramCode" | "requestEmailCode";

/** Self-service KYC verification: Telegram contact share, or a 6-digit code via Telegram/email. */
export function KycVerify({
  kycStatus,
  hasTelegram,
  hasEmail,
}: {
  kycStatus: string;
  hasTelegram: boolean;
  hasEmail: boolean;
}) {
  const t = useTranslations("Settings");
  const [verified, setVerified] = useState(kycStatus === "VERIFIED");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const r = await fetch("/api/me/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j.ok) setError(j.error?.message ?? t("verifyError"));
      return j;
    } catch {
      setError(t("verifyError"));
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }

  async function request(action: Action) {
    const j = await post({ action });
    if (j.ok) setMsg(action === "requestTelegramContact" ? t("contactSent") : t("codeSent"));
  }

  async function confirm() {
    const j = await post({ action: "verifyCode", code });
    if (j.ok && j.data?.verified) {
      setVerified(true);
      setCode("");
    }
  }

  if (verified) {
    return <p className="text-sm font-medium text-green-800">{t("verifyVerified")}</p>;
  }

  const field = "h-10 rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 text-sm";
  return (
    <div className="space-y-3 rounded-xl border border-[hsl(var(--border))] p-4">
      <p className="text-sm font-medium">{t("verifyTitle")}</p>
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("verifyHint")}</p>
      <div className="flex flex-wrap gap-2">
        {hasTelegram && (
          <Button size="sm" variant="accent" disabled={busy} onClick={() => request("requestTelegramContact")}>
            {t("verifySharePhone")}
          </Button>
        )}
        {hasTelegram && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => request("requestTelegramCode")}>
            {t("verifyCodeTg")}
          </Button>
        )}
        {hasEmail && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => request("requestEmailCode")}>
            {t("verifyCodeEmail")}
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          className={`${field} w-32`}
          inputMode="numeric"
          maxLength={6}
          aria-label={t("verifyCodePh")}
          placeholder={t("verifyCodePh")}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
        <Button size="sm" disabled={busy || code.length !== 6} onClick={confirm}>
          {t("verifyConfirm")}
        </Button>
      </div>
      {msg && <p className="text-sm text-[hsl(var(--primary-ink))]" role="status">{msg}</p>}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}
