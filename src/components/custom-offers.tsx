"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { formatUzs } from "@/lib/utils";

export interface Offer {
  id: string;
  title: string;
  priceUzs: number;
  deliveryDays: number;
  revisions: number;
  status: string;
}

/** Custom offers panel inside a conversation: seller composes, buyer accepts → order. */
export function CustomOffers({
  conversationId,
  role,
  initial,
}: {
  conversationId: string;
  role: "seller" | "buyer";
  initial: Offer[];
}) {
  const t = useTranslations("Offer");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("3");
  const [rev, setRev] = useState("1");

  const field = "h-10 rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 text-sm";

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/conversations/${conversationId}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          priceUzs: Number(price),
          deliveryDays: Number(days) || 1,
          revisions: Number(rev) || 0,
        }),
      });
      const j = await r.json();
      if (j.ok) {
        setTitle("");
        setPrice("");
        setSent(true);
        router.refresh();
      } else setError(j.error?.message ?? t("error"));
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
    }
  }

  async function act(offerId: string, action: "accept" | "decline") {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/offers/${offerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await r.json();
      if (j.ok) {
        if (j.data?.orderId) router.push(`/orders/${j.data.orderId}`);
        else router.refresh();
      } else {
        setError(j.error?.message ?? t("error"));
        setBusy(false);
      }
    } catch {
      setError(t("error"));
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-4">
      <p className="mb-3 text-sm font-medium">{t("title")}</p>

      {role === "seller" && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <input
            className={field}
            aria-label={t("offerTitle")}
            placeholder={t("offerTitle")}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSent(false);
            }}
          />
          <input
            className={field}
            inputMode="numeric"
            aria-label={t("price")}
            placeholder={t("price")}
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
          />
          <input
            className={field}
            inputMode="numeric"
            aria-label={t("days")}
            placeholder={t("days")}
            value={days}
            onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
          />
          <input
            className={field}
            inputMode="numeric"
            aria-label={t("revisions")}
            placeholder={t("revisions")}
            value={rev}
            onChange={(e) => setRev(e.target.value.replace(/\D/g, ""))}
          />
          <Button onClick={send} disabled={busy || !title.trim() || !price}>
            {t("send")}
          </Button>
        </div>
      )}

      {initial.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("none")}</p>
      ) : (
        <ul className="space-y-2">
          {initial.map((o) => (
            <li key={o.id} className="rounded-lg border border-[hsl(var(--border))] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{o.title}</span>
                <span className="font-semibold tabular-nums">{formatUzs(o.priceUzs)} so&apos;m</span>
              </div>
              <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                {o.deliveryDays} {t("daysShort")} · {o.revisions} {t("revShort")} · {t(`status.${o.status}`)}
              </p>
              {o.status === "PENDING" && (
                <div className="mt-2 flex gap-2">
                  {role === "buyer" && (
                    <Button size="sm" variant="accent" onClick={() => act(o.id, "accept")} disabled={busy}>
                      {t("accept")}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => act(o.id, "decline")} disabled={busy}>
                    {t("decline")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {sent && <p className="mt-2 text-sm font-medium text-[hsl(var(--success))]">{t("sent")}</p>}
      {error && <p className="mt-2 text-sm text-[hsl(var(--danger))]">{error}</p>}
    </div>
  );
}
