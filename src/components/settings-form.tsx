"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface Prefs {
  orders: boolean;
  messages: boolean;
  reviews: boolean;
}

export function SettingsForm({
  initial,
  hasEmail,
  hasTelegram,
}: {
  initial: { notifyTelegram: boolean; notifyEmail: boolean; prefs: Prefs };
  hasEmail: boolean;
  hasTelegram: boolean;
}) {
  const t = useTranslations("Settings");
  const [tg, setTg] = useState(initial.notifyTelegram);
  const [em, setEm] = useState(initial.notifyEmail);
  const [prefs, setPrefs] = useState<Prefs>(initial.prefs);
  const [saved, setSaved] = useState(false);

  function togglePref(key: keyof Prefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    save({ notifyPrefs: next });
  }

  async function save(next: {
    notifyTelegram?: boolean;
    notifyEmail?: boolean;
    notifyPrefs?: Prefs;
  }) {
    setSaved(false);
    const r = await fetch("/api/me/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if ((await r.json()).ok) setSaved(true);
  }

  const row = "flex items-center justify-between gap-4 rounded-xl border border-[hsl(var(--border))] p-4";

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
      {saved && <p className="text-sm text-green-600">{t("saved")}</p>}
    </div>
  );
}
