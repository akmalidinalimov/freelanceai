"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { GalleryUpload } from "@/components/gallery-upload";
import { formatUzs } from "@/lib/utils";
import { approxPrice } from "@/lib/currency";

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
  freeMode = false,
}: {
  gigId: string;
  locale: string;
  viewer: "guest" | "buyer" | "owner";
  packages: Pkg[];
  extras?: Extra[];
  requirementPrompts?: string[];
  /** Test mode: orders settle free (no payment). Shows a note so testers know it's intentional. */
  freeMode?: boolean;
}) {
  const t = useTranslations("Gig");
  const to = useTranslations("Order");
  const [tier, setTier] = useState<Pkg["tier"]>(packages[0]?.tier ?? "BASIC");

  // Restore the tier a guest had picked before being sent through login
  // (?tier=… is round-tripped via the login `next` param). Post-mount to
  // keep server and first client render identical (no hydration mismatch).
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tier");
    if (wanted && packages.some((p) => p.tier === wanted)) setTier(wanted as Pkg["tier"]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
    track("order_cta_click", gigId); // funnel numerator lives server-side (order_created)
    if (viewer === "guest") {
      // Round-trip the gig AND the chosen tier through login so the buyer
      // returns exactly where they left off (critique P1: context loss).
      const next = encodeURIComponent(`${window.location.pathname}?tier=${tier}`);
      window.location.href = `/${locale}/login?next=${next}`;
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
      <div className="flex gap-1 rounded-[var(--radius-md)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-1">
        {packages.map((p) => (
          <button
            key={p.tier}
            onClick={() => setTier(p.tier)}
            aria-pressed={p.tier === tier}
            className={`flex-1 rounded-[var(--radius-sm)] px-2 py-1.5 text-xs font-semibold transition-colors ${
              p.tier === tier
                ? "bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-[var(--shadow-soft)] ring-1 ring-[hsl(var(--primary))]/40"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {p.tier === "STANDARD" ? `⭐ ${tierLabel[p.tier]}` : tierLabel[p.tier]}
          </button>
        ))}
      </div>

      {selected && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{selected.title}</span>
            <span className="text-right">
              <span className="block text-xl font-bold tabular-nums">
                {formatUzs(selected.priceUzs)} so&apos;m
              </span>
              <span className="block text-xs font-normal text-[hsl(var(--muted-foreground))]">
                {approxPrice(selected.priceUzs)}
              </span>
            </span>
          </div>
          {selected.description &&
            (selected.description.includes("✓") ? (
              (() => {
                const lines = selected.description.split("\n");
                const taglines = lines.filter((l) => l.trim() && !l.startsWith("✓"));
                const features = lines.filter((l) => l.startsWith("✓")).map((l) => l.replace(/^✓\s*/, ""));
                // Condensed: top 3 features here; the compare table below is the single
                // full source (critique P2: the same list was read twice per scroll).
                const shown = features.slice(0, 3);
                const rest = features.length - shown.length;
                return (
                  <div className="mt-3">
                    {taglines.map((line, i) => (
                      <p key={i} className="mb-2 text-[13px] font-semibold text-[hsl(var(--primary-ink))]">
                        {line}
                      </p>
                    ))}
                    <ul className="space-y-1.5">
                      {shown.map((line, i) => (
                        <li key={i} className="flex gap-2 text-sm leading-snug">
                          <span aria-hidden className="mt-0.5 shrink-0 font-bold text-[hsl(var(--success))]">
                            ✓
                          </span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                    {rest > 0 && (
                      <p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">{to("andMore", { count: rest })}</p>
                    )}
                  </div>
                );
              })()
            ) : (
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{selected.description}</p>
            ))}
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <span className="rounded-[var(--radius-sm)] bg-[hsl(var(--surface-2))] px-3 py-2 text-center font-medium">
              {selected.deliveryDays} {t("daysDelivery")}
            </span>
            <span className="rounded-[var(--radius-sm)] bg-[hsl(var(--surface-2))] px-3 py-2 text-center font-medium">
              {selected.revisions} {t("revisionsLabel")}
            </span>
          </div>
        </div>
      )}

      {extras.length > 0 && viewer !== "owner" && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-[var(--shadow-soft)]">
          <p className="mb-2 text-sm font-medium">{to("extras")}</p>
          <div role="group" aria-label={to("extras")} className="space-y-2">
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
              <div className="space-y-3 rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-soft)] sm:p-6">
                {requirementPrompts.map((q, i) => (
                  <label key={i} className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{q}</span>
                    <textarea
                      value={answers[i] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                      className="min-h-16 w-full rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 py-2 text-sm"
                    />
                  </label>
                ))}
                <textarea
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder={to("requirementsPh")}
                  aria-label={to("requirementsPh")}
                  className="min-h-24 w-full rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 py-2 text-sm"
                />
                <GalleryUpload
                  value={reqFiles}
                  onChange={setReqFiles}
                  prefix="requirements"
                  label={to("requirementFiles")}
                />
              </div>
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                aria-label={to("couponPh")}
                placeholder={to("couponPh")}
                className="h-10 w-full rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 text-sm uppercase"
              />
            </>
          )}
          {error && (
            <div role="alert" className="rounded-md border border-[hsl(var(--danger))]/30 bg-[hsl(var(--danger-soft))] px-3 py-2">
              <p className="text-sm font-medium text-[hsl(var(--danger))]">{error}</p>
              {/* No lost work — the buyer's tier/requirements are still in state. */}
              <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{to("errorRetry")}</p>
            </div>
          )}
          <Button className="w-full" size="lg" onClick={placeOrder} disabled={busy}>
            {busy ? to("placing") : to("placeOrder")}
          </Button>
          <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">
            {freeMode ? `🧪 ${to("freeTestNote")}` : to("noPaymentYet")}
          </p>
        </>
      )}
    </div>
  );
}
