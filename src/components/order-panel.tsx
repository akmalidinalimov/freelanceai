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

export function OrderPanel({
  gigId,
  locale,
  viewer,
  packages,
}: {
  gigId: string;
  locale: string;
  viewer: "guest" | "buyer" | "owner";
  packages: Pkg[];
}) {
  const t = useTranslations("Gig");
  const to = useTranslations("Order");
  const [tier, setTier] = useState<Pkg["tier"]>(packages[0]?.tier ?? "BASIC");
  const [requirements, setRequirements] = useState("");
  const [reqFiles, setReqFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = packages.find((p) => p.tier === tier) ?? packages[0];
  const tierLabel = { BASIC: t("basic"), STANDARD: t("standard"), PREMIUM: t("premium") };

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

      {viewer === "owner" ? (
        <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">{to("ownGig")}</p>
      ) : (
        <>
          {viewer === "buyer" && (
            <>
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
