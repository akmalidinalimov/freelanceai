"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Account controls (Settings page): data export + delete-account danger zone.
 * Backend: GET /api/me/export, POST /api/me/delete (see UI-REQUESTS.md task 1).
 */
export function AccountSection() {
  const t = useTranslations("Account");
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const row =
    "flex items-center justify-between gap-4 rounded-xl border border-[hsl(var(--border))] p-4";

  async function exportData() {
    setExporting(true);
    setError(null);
    try {
      const r = await fetch("/api/me/export");
      const j = await r.json();
      if (!j.ok) throw new Error(j.error?.message);
      const blob = new Blob([JSON.stringify(j.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "gigora-data.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("error"));
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    setError(null);
    const r = await fetch("/api/me/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) {
      // Session is already destroyed server-side — leave the app entirely.
      window.location.href = "/";
      return;
    }
    setDeleting(false);
    // 409 CONFLICT carries a specific reason (active orders / seller balance).
    setError(j?.error?.message ?? t("error"));
  }

  return (
    <div className="space-y-3">
      <p className="pt-4 text-sm font-medium">{t("title")}</p>

      {/* Data export */}
      <div className={row}>
        <span>
          <span className="font-medium">{t("exportTitle")}</span>
          <span className="block text-sm text-[hsl(var(--muted-foreground))]">
            {t("exportHint")}
          </span>
        </span>
        <Button size="sm" variant="outline" onClick={exportData} disabled={exporting}>
          <Download className="h-4 w-4" />
          {exporting ? t("exporting") : t("exportBtn")}
        </Button>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-[hsl(var(--danger))]/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--danger))]">
          {t("dangerTitle")}
        </p>
        <div className="mt-2 flex flex-col gap-3">
          <span>
            <span className="font-medium">{t("deleteTitle")}</span>
            <span className="block text-sm text-[hsl(var(--muted-foreground))]">
              {t("deleteHint")}
            </span>
          </span>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              {t("confirmLabel")}
            </span>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              className="h-10 w-44 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-sm"
            />
          </label>
          <div>
            <Button
              size="sm"
              onClick={deleteAccount}
              disabled={confirmText !== "DELETE" || deleting}
              variant="destructive"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? t("deleting") : t("deleteBtn")}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-[hsl(var(--danger))]/40 bg-[hsl(var(--danger-soft))] px-3 py-2 text-sm text-[hsl(var(--danger))]">
          {error}
        </p>
      )}
    </div>
  );
}
