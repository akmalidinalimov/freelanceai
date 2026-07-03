"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const PRESETS = [10000, 25000, 50000];

/** Buyer tips the seller on a completed order (presets or custom amount). */
export function TipButton({ orderId }: { orderId: string }) {
  const t = useTranslations("Order");
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // Stable per-form idempotency key: a double-click / retry of this tip dedups server-side
  // instead of double-crediting the seller.
  const [idemKey] = useState(() => crypto.randomUUID());

  async function tip(value: number) {
    if (busy || value < 1000) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/orders/${orderId}/tip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUzs: value, idempotencyKey: idemKey }),
      });
      if ((await r.json()).ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("tipThanks")}</p>;

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-4">
      <p className="mb-2 text-sm font-medium">{t("tipTitle")}</p>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Button key={p} size="sm" variant="outline" disabled={busy} onClick={() => tip(p)}>
            +{p.toLocaleString()}
          </Button>
        ))}
        <input
          className="h-9 w-28 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 text-sm"
          inputMode="numeric"
          aria-label={t("tipCustom")}
          placeholder={t("tipCustom")}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
        />
        <Button size="sm" disabled={busy || Number(amount) < 1000} onClick={() => tip(Number(amount))}>
          {t("tipSend")}
        </Button>
      </div>
    </div>
  );
}
