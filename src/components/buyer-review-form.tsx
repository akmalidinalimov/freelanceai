"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Seller reviews the buyer on a completed order (two-way reviews). */
export function BuyerReviewForm({ orderId }: { orderId: string }) {
  const t = useTranslations("Review");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (rating < 1) {
      setError(t("pickRating"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/orders/${orderId}/buyer-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      const j = await r.json();
      if (j.ok) window.location.reload();
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
    <div className="space-y-3 rounded-xl border border-[hsl(var(--border))] p-5">
      <p className="text-sm font-medium">{t("reviewBuyer")}</p>
      <div role="group" aria-label={t("pickRating")} className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            aria-pressed={n <= rating}
            className="text-3xl leading-none transition-colors"
            style={{ color: n <= (hover || rating) ? "#f5a623" : "hsl(var(--border))" }}
            aria-label={`${n}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t("commentPh")}
        aria-label={t("commentPh")}
        className="min-h-20 w-full rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 py-2 text-sm"
      />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button onClick={submit} disabled={busy}>
        {busy ? t("submitting") : t("submit")}
      </Button>
    </div>
  );
}
