"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function ReviewReply({ reviewId }: { reviewId: string }) {
  const t = useTranslations("Review");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    const r = await fetch(`/api/reviews/${reviewId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: text }),
    });
    if ((await r.json()).ok) window.location.reload();
    else setBusy(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-expanded={open} className="mt-2 text-xs text-[hsl(var(--primary-ink))] hover:underline">
        {t("reply")}
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("replyPh")}
        aria-label={t("replyPh")}
        className="min-h-16 w-full rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 py-2 text-sm"
      />
      <Button size="sm" onClick={submit} disabled={busy}>
        {t("sendReply")}
      </Button>
    </div>
  );
}
