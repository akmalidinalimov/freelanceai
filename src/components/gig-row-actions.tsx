"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** Pause / resume / delete actions for a gig row on the creator dashboard. */
export function GigRowActions({ gigId, status }: { gigId: string; status: string }) {
  const t = useTranslations("Gig");
  const [busy, setBusy] = useState(false);

  async function act(action: "pause" | "resume" | "delete" | "publish" | "duplicate") {
    if (action === "delete" && !window.confirm(t("confirmDelete"))) return;
    setBusy(true);
    const r = await fetch(`/api/gigs/${gigId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const j = await r.json();
    if (j.ok) window.location.reload();
    else setBusy(false);
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <Link href={`/dashboard/seller/gigs/${gigId}/edit`} className="text-[hsl(var(--primary-ink))] hover:underline">
        {t("edit")}
      </Link>
      {status === "DRAFT" && (
        <button onClick={() => act("publish")} disabled={busy} className="font-medium text-[hsl(var(--primary-ink))] hover:underline">
          {t("publish")}
        </button>
      )}
      {status === "ACTIVE" ? (
        <button onClick={() => act("pause")} disabled={busy} className="hover:underline">
          {t("pause")}
        </button>
      ) : (
        <button onClick={() => act("resume")} disabled={busy} className="text-[hsl(var(--primary-ink))] hover:underline">
          {t("resume")}
        </button>
      )}
      <button onClick={() => act("duplicate")} disabled={busy} className="hover:underline">
        {t("duplicate")}
      </button>
      <button onClick={() => act("delete")} disabled={busy} className="text-red-700 hover:underline">
        {t("delete")}
      </button>
    </span>
  );
}
