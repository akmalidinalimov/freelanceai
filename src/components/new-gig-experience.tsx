"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { GigForm, type GigInitial } from "@/components/gig-form";

interface Category {
  id: string;
  name: string;
}
type Tier = "BASIC" | "STANDARD" | "PREMIUM";

interface DraftPackage {
  tier: Tier;
  title: string;
  description: string;
  priceUzs: number;
  deliveryDays: number;
  revisions: number;
}
interface GigDraft {
  title: string;
  description: string;
  tags: string[];
  packages: DraftPackage[];
  extras: { title: string; priceUzs: number }[];
  requirementPrompts: string[];
}

/** Map the AI/template draft (numbers) + the seller's category pick onto GigForm's initial (strings). */
function toInitial(draft: GigDraft, categoryId: string): GigInitial {
  const packages: GigInitial["packages"] = {};
  for (const p of draft.packages) {
    packages[p.tier] = {
      title: p.title,
      priceUzs: String(p.priceUzs),
      deliveryDays: String(p.deliveryDays),
      revisions: String(p.revisions),
    };
  }
  return {
    title: draft.title,
    description: draft.description,
    categoryId,
    tags: draft.tags.join(", "),
    galleryUrls: [],
    faq: [],
    extras: draft.extras.map((e) => ({ title: e.title, priceUzs: String(e.priceUzs), deliveryDays: "" })),
    requirementPrompts: draft.requirementPrompts,
    packages,
  };
}

/**
 * New-gig experience: offer an AI-assisted wizard (answer a few questions → a structured draft
 * generated in the seller's language) OR the blank form. The wizard hands its draft into the SAME
 * GigForm, so every gig — AI-made or hand-made — has the identical structured shape. AI is
 * fail-open (the server falls back to a deterministic template), so "Generate" always yields a
 * filled form, never an error.
 */
export function NewGigExperience({ locale, categories }: { locale: string; categories: Category[] }) {
  const t = useTranslations("Gig");
  const [mode, setMode] = useState<"choice" | "ai" | "form">("choice");
  const [draft, setDraft] = useState<GigInitial | undefined>(undefined);

  // Wizard field state
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [service, setService] = useState("");
  const [deliverable, setDeliverable] = useState("");
  const [days, setDays] = useState("3");
  const [price, setPrice] = useState("");
  const [differentiator, setDifferentiator] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = "h-11 w-full rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 text-sm";

  async function generate() {
    setError(null);
    if (service.trim().length < 2 || deliverable.trim().length < 2 || !price) {
      return setError(t("aiFillAll"));
    }
    setBusy(true);
    try {
      const r = await fetch("/api/gigs/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: service.trim(),
          deliverable: deliverable.trim(),
          days: Math.max(1, parseInt(days, 10) || 3),
          priceUzs: Math.max(1000, parseInt(price, 10) || 1000),
          differentiator: differentiator.trim() || undefined,
          locale,
        }),
      });
      const j = await r.json();
      if (!j.ok) return setError(j.error?.message ?? t("aiError"));
      setDraft(toInitial(j.data.draft as GigDraft, categoryId));
      setMode("form");
    } catch {
      setError(t("aiError"));
    } finally {
      setBusy(false);
    }
  }

  if (mode === "form") {
    return <GigForm locale={locale} categories={categories} initial={draft} />;
  }

  if (mode === "choice") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("ai")}
          className="rounded-2xl border border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/[0.06] p-5 text-left transition-colors hover:bg-[hsl(var(--primary))]/[0.1]"
        >
          <span className="text-lg font-bold">✨ {t("aiOptionTitle")}</span>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t("aiOptionDesc")}</p>
        </button>
        <button
          type="button"
          onClick={() => setMode("form")}
          className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left transition-colors hover:border-[hsl(var(--primary))]"
        >
          <span className="text-lg font-bold">{t("scratchOptionTitle")}</span>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t("scratchOptionDesc")}</p>
        </button>
      </div>
    );
  }

  // mode === "ai"
  return (
    <div className="space-y-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <div>
        <h2 className="font-display text-lg font-bold">✨ {t("aiWizardTitle")}</h2>
        <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{t("aiWizardIntro")}</p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">{t("aiCategory")}</span>
        <select className={field} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">{t("aiService")}</span>
        <input className={field} value={service} onChange={(e) => setService(e.target.value)} placeholder={t("aiServicePh")} />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">{t("aiDeliverable")}</span>
        <input className={field} value={deliverable} onChange={(e) => setDeliverable(e.target.value)} placeholder={t("aiDeliverablePh")} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">{t("aiDays")}</span>
          <input className={field} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">{t("aiPrice")}</span>
          <input className={field} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} placeholder="50000" />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">
          {t("aiDiff")} <span className="text-[hsl(var(--muted-foreground))]">({t("optional")})</span>
        </span>
        <input className={field} value={differentiator} onChange={(e) => setDifferentiator(e.target.value)} placeholder={t("aiDiffPh")} />
      </label>

      {error && <p className="text-sm text-[hsl(var(--danger))]" role="alert">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="rounded-md bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] disabled:opacity-60"
        >
          {busy ? t("aiGenerating") : t("aiGenerate")}
        </button>
        <button type="button" onClick={() => setMode("choice")} className="text-sm text-[hsl(var(--muted-foreground))] hover:underline">
          {t("aiBack")}
        </button>
      </div>
    </div>
  );
}
