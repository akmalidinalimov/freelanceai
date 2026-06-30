"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const field = "h-9 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-sm";

export function ConfirmPaymentButton({ orderId }: { orderId: string }) {
  const t = useTranslations("Admin");
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    const r = await fetch(`/api/orders/${orderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm_payment" }),
    });
    const j = await r.json();
    if (j.ok) window.location.reload();
    else setBusy(false);
  }

  return (
    <Button size="sm" variant="accent" onClick={go} disabled={busy}>
      {t("confirm")}
    </Button>
  );
}

export function PayoutForm({
  sellerId,
  availableUzs,
  defaultCard,
}: {
  sellerId: string;
  availableUzs: number;
  defaultCard?: string | null;
}) {
  const t = useTranslations("Admin");
  const [amount, setAmount] = useState(String(availableUzs));
  const [card, setCard] = useState(defaultCard ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    const amt = parseInt(amount, 10);
    if (!Number.isFinite(amt) || amt <= 0 || card.trim().length < 4) {
      setError(t("error"));
      return;
    }
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sellerId, amountUzs: amt, cardMasked: card.trim() }),
    });
    const j = await r.json();
    if (j.ok) window.location.reload();
    else {
      setError(j.error?.message ?? t("error"));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="numeric"
        className={`${field} w-28`}
        aria-label={t("amount")}
      />
      <input
        value={card}
        onChange={(e) => setCard(e.target.value)}
        placeholder={t("cardPh")}
        className={`${field} w-44`}
        aria-label={t("cardLabel")}
      />
      <Button size="sm" onClick={go} disabled={busy}>
        {t("recordPayout")}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
