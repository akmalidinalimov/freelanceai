"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

async function post(body: Record<string, unknown>): Promise<boolean> {
  const r = await fetch("/api/saved-searches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await r.json()).ok;
}

export function SaveSearchButton({
  filters,
}: {
  filters: { q?: string; categorySlug?: string; minUzs?: number; maxUzs?: number };
}) {
  const t = useTranslations("SavedSearch");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function save() {
    setBusy(true);
    const ok = await post({ action: "create", ...filters });
    if (ok) {
      setDone(true);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={save} disabled={busy || done}>
      {done ? t("saved") : t("save")}
    </Button>
  );
}

export function DeleteSavedSearch({ id }: { id: string }) {
  const t = useTranslations("SavedSearch");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function del() {
    setBusy(true);
    if (await post({ action: "delete", id })) router.refresh();
    setBusy(false);
  }
  return (
    <button onClick={del} disabled={busy} aria-label={t("delete")} className="text-[hsl(var(--muted-foreground))] hover:text-red-700">
      ×
    </button>
  );
}
