"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Action = "suspend" | "unsuspend" | "makeSeller" | "removeSeller";

/** Admin row actions: suspend/unsuspend + toggle seller (never grants admin). */
export function UserRowActions({
  userId,
  status,
  isSeller,
}: {
  userId: string;
  status: string;
  isSeller: boolean;
}) {
  const t = useTranslations("AdminUsers");
  const [busy, setBusy] = useState(false);

  async function act(action: Action) {
    setBusy(true);
    const r = await fetch(`/api/admin/users/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if ((await r.json()).ok) window.location.reload();
    else setBusy(false);
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      {status === "SUSPENDED" ? (
        <button onClick={() => act("unsuspend")} disabled={busy} className="text-[hsl(var(--primary-ink))] hover:underline">
          {t("unsuspend")}
        </button>
      ) : (
        <button onClick={() => act("suspend")} disabled={busy} className="text-red-700 hover:underline">
          {t("suspend")}
        </button>
      )}
      {isSeller ? (
        <button onClick={() => act("removeSeller")} disabled={busy} className="hover:underline">
          {t("removeSeller")}
        </button>
      ) : (
        <button onClick={() => act("makeSeller")} disabled={busy} className="hover:underline">
          {t("makeSeller")}
        </button>
      )}
    </span>
  );
}
