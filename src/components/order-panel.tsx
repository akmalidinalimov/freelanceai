"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { GalleryUpload } from "@/components/gallery-upload";
import { formatUzs } from "@/lib/utils";

interface Pkg {
  tier: "BASIC" | "STANDARD" | "PREMIUM";
  title: string;
  description?: string | null;
  priceUzs: number;
  deliveryDays: number;
  revisions: number;
}

interface Extra {
  id: string;
  title: string;
  priceUzs: number;
  deliveryDays: number;
}

export function OrderPanel({
  gigId,
  locale,
  viewer,
  packages,
  extras = [],
  requirementPrompts = [],
}: {
  gigId: string;
  locale: string;
  viewer: "guest" | "buyer" | "owner";
  packages: Pkg[];
  extras?: Extra[];
  requirementPrompts?: string[];
}) {
  const t = useTranslations("Gig");
  const to = useTranslations("Order");
  const [tier, setTier] = useState<Pkg["tier"]>(packages[0]?.tier ?? "BASIC");
  const [requirements, setRequirements] = useState("");
  const [reqFiles, setReqFiles] = useState<string[]>([]);
  const [coupon, setCoupon] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [chosenExtras, setChosenExtras] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = packages.find((p) => p.tier === tier) ?? packages[0];
  const tierLabel = { BASIC: t("basic"), STANDARD: t("standard"), PREMIUM: t("premium") };
  const extrasTotal = extras.filter((e) => chosenExtras.has(e.id)).reduce((a, e) => a + e.priceUzs, 0);
  const total = (selected?.priceUzs ?? 0) + extrasTotal;

  function toggleExtra(id: string) {
    setChosenExtras((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function placeOrder() {
    if (viewer === "guest") {
      window.location.href = `/${locale}/login`;
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gigId,
          tier,
          requirements: requirements.trim() || undefined,
          requirementFileUrls: reqFiles,
          extraIds: extras.filter((e) => chosenExtras.has(e.id)).map((e) => e.id),
          couponCode: coupon.trim() || undefined,
          requirementAnswers: requirementPrompts
            .map((q, i) => ({ q, a: (answers[i] ?? "").trim() }))
            .filter((x) => x.a),
        }),
      });
      const j = await r.json();
      if (j.ok) window.location.href = `/${locale}/orders/${j.data.id}`;
      else {
        setError(j.error?.message ?? to("error"));
        setBusy(false);
      }
    } catch {
      setError(to("error"));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {packages.map((p) => (
          <button
            key={p.tier}
            onClick={() => setTier(p.tier)}
            className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
              p.tier === tier
                ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                : "border-[hsl(var(--border))]"
            }`}
          >
            {tierLabel[p.tier]}
          </button>
        ))}
      </div>

      {selected && (
        <div className="rounded-xl border border-[hsl(var(--border))] p-5">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{selected.title}</span>
            <span className="text-xl font-bold tabular-nums">
              {formatUzs(selected.priceUzs)} so&apos;m
            </span>
          </div>
          {selected.description && (
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{selected.description}</p>
          )}
          <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
            {selected.deliveryDays} {t("daysDelivery")} · {selected.revisions} {t("revisionsLabel")}
          </p>
        </div>
      )}

      {extras.length > 0 && viewer !== "owner" && (
        <div className="rounded-xl border border-[hsl(var(--border))] p-4">
          <p className="mb-2 text-sm font-medium">{to("extras")}</p>
          <div className="space-y-2">
            {extras.map((e) => (
              <label key={e.id} className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={chosenExtras.has(e.id)} onChange={() => toggleExtra(e.id)} />
                  {e.title}
                  {e.deliveryDays > 0 && (
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      (+{e.deliveryDays} {t("daysDelivery")})
                    </span>
                  )}
                </span>
                <span className="tabular-nums">+{formatUzs(e.priceUzs)}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[hsl(var(--border))] pt-2 text-sm font-semibold">
            <span>{to("total")}</span>
            <span className="tabular-nums">{formatUzs(total)} so&apos;m</span>
          </div>
        </div>
      )}

      {viewer === "owner" ? (
        <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">{to("ownGig")}</p>
      ) : (
        <>
          {viewer === "buyer" && (
            <>
              {requirementPrompts.map((q, i) => (
                <label key={i} className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{q}</span>
                  <textarea
                    value={answers[i] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                    className="min-h-16 w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
                  />
                </label>
              ))}
              <textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder={to("requirementsPh")}
                className="min-h-24 w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
              />
              <GalleryUpload
                value={reqFiles}
                onChange={setReqFiles}
                prefix="requirements"
                label={to("requirementFiles")}
              />
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                placeholder={to("couponPh")}
                className="h-10 w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-sm uppercase"
              />
            </>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button className="w-full" size="lg" onClick={placeOrder} disabled={busy}>
            {busy ? to("placing") : to("placeOrder")}
          </Button>
          <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">{to("noPaymentYet")}</p>
        </>
      )}
    </div>
  );
}
