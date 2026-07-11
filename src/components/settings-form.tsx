"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface Prefs {
  orders: boolean;
  messages: boolean;
  reviews: boolean;
}

export function SettingsForm({
  initial,
  isSeller,
  hasEmail,
  hasTelegram,
}: {
  initial: {
    notifyTelegram: boolean;
    notifyEmail: boolean;
    prefs: Prefs;
    phone: string;
    payoutCardMasked: string;
    kycStatus: string;
  };
  isSeller: boolean;
  hasEmail: boolean;
  hasTelegram: boolean;
}) {
  const t = useTranslations("Settings");
  const [tg, setTg] = useState(initial.notifyTelegram);
  const [em, setEm] = useState(initial.notifyEmail);
  const [prefs, setPrefs] = useState<Prefs>(initial.prefs);
  const [phone, setPhone] = useState(initial.phone);
  const [card, setCard] = useState(initial.payoutCardMasked);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePref(key: keyof Prefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    save({ notifyPrefs: next });
  }

  async function save(next: {
    notifyTelegram?: boolean;
    notifyEmail?: boolean;
    notifyPrefs?: Prefs;
    phone?: string;
    payoutCardMasked?: string;
  }) {
    setSaved(false);
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/me/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const j = await r.json();
      if (j.ok) setSaved(true);
      else setError(j.error?.message ?? t("saveError"));
    } catch {
      setError(t("saveError"));
    } finally {
      setBusy(false);
    }
  }

  const row = "flex items-center justify-between gap-4 rounded-xl border border-[hsl(var(--border))] p-4";
  const field = "h-10 rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 text-sm";
  const kycLabel =
    initial.kycStatus === "VERIFIED" ? t("kycVerified") : initial.phone ? t("kycPending") : t("kycNone");

  return (
    <div className="space-y-3">
      <label className={row}>
        <span>
          <span className="font-medium">{t("telegram")}</span>
          <span className="block text-sm text-[hsl(var(--muted-foreground))]">{t("telegramHint")}</span>
        </span>
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={tg}
          disabled={!hasTelegram}
          onChange={(e) => {
            setTg(e.target.checked);
            save({ notifyTelegram: e.target.checked });
          }}
        />
      </label>
      <label className={row}>
        <span>
          <span className="font-medium">{t("email")}</span>
          <span className="block text-sm text-[hsl(var(--muted-foreground))]">
            {hasEmail ? t("emailHint") : t("noEmail")}
          </span>
        </span>
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={em}
          disabled={!hasEmail}
          onChange={(e) => {
            setEm(e.target.checked);
            save({ notifyEmail: e.target.checked });
          }}
        />
      </label>

      <div role="group" aria-label={t("categories")} className="space-y-3">
        <p className="pt-2 text-sm font-medium">{t("categories")}</p>
        {(["orders", "messages", "reviews"] as const).map((key) => (
          <label key={key} className={row}>
            <span className="font-medium">{t(`cat_${key}`)}</span>
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={prefs[key]}
              onChange={(e) => togglePref(key, e.target.checked)}
            />
          </label>
        ))}
      </div>

      {/* KYC / verification */}
      <div className="pt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">{t("kycTitle")}</p>
          <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">{kycLabel}</span>
        </div>
        <div className={row}>
          <span>
            <span className="font-medium">{t("phone")}</span>
            <span className="block text-sm text-[hsl(var(--muted-foreground))]">{t("phoneHint")}</span>
          </span>
          <div className="flex items-center gap-2">
            <input
              className={`${field} w-44`}
              placeholder="+998 90 123 45 67"
              aria-label={t("phone")}
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={() => save({ phone: phone.replace(/[^\d+]/g, "") })}>
              {t("save")}
            </Button>
          </div>
        </div>
      </div>

      {/* Seller payout destination */}
      {isSeller && (
        <div className="pt-2">
          <p className="mb-2 text-sm font-medium">{t("payoutTitle")}</p>
          <div className={row}>
            <span>
              <span className="font-medium">{t("payoutCard")}</span>
              <span className="block text-sm text-[hsl(var(--muted-foreground))]">{t("payoutCardHint")}</span>
            </span>
            <div className="flex items-center gap-2">
              <input
                className={`${field} w-44`}
                placeholder="8600 1234 5678 9012"
                aria-label={t("payoutCard")}
                inputMode="numeric"
                value={card}
                onChange={(e) => setCard(e.target.value)}
              />
              <Button size="sm" variant="outline" onClick={() => save({ payoutCardMasked: card })}>
                {t("save")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {saved && !error && <p className="text-sm text-[hsl(var(--success))]">{t("saved")}</p>}
      {error && <p role="alert" className="text-sm text-[hsl(var(--danger))]">{error}</p>}
    </div>
  );
}
