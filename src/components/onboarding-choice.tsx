"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Briefcase, Palette, ChevronRight } from "lucide-react";
import { GalleryUpload } from "@/components/gallery-upload";
import { FormSection, fieldClass } from "@/components/ui/form-section";

/**
 * First-login onboarding, two steps:
 *  1. Who you are — name (PREFILLED from Telegram/Google; email users type it once)
 *     + the buy-vs-sell intent cards. Buyers finish here (near-zero friction).
 *  2. Freelancer credentials — years of AI experience (tap chips) + portfolio
 *     samples. The role switch happens at step 1's POST, so step-2 uploads pass the
 *     seller-only presign gate. Skippable: the approval checklist re-asks later,
 *     so an empty portfolio never strands the funnel.
 */
export function OnboardingChoice({
  locale,
  initialFirstName = "",
  initialLastName = "",
}: {
  locale: string;
  initialFirstName?: string;
  initialLastName?: string;
}) {
  const t = useTranslations("Onboarding");
  const [step, setStep] = useState<"who" | "creds">("who");
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [busy, setBusy] = useState<"buy" | "sell" | "creds" | null>(null);
  const [error, setError] = useState(false);
  const [experience, setExperience] = useState<number | null>(null);
  const [portfolio, setPortfolio] = useState<string[]>([]);

  const gigWizard = `/${locale}/dashboard/seller/gigs/new`;

  async function post(body: Record<string, unknown>): Promise<boolean> {
    try {
      const r = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return (await r.json()).ok === true;
    } catch {
      return false;
    }
  }

  async function choose(intent: "buy" | "sell") {
    setBusy(intent);
    setError(false);
    const ok = await post({ intent, firstName: firstName.trim(), lastName: lastName.trim() });
    if (!ok) {
      setError(true);
      setBusy(null);
      return;
    }
    if (intent === "buy") {
      window.location.href = `/${locale}/gigs`;
    } else {
      // Now a seller — step-2 portfolio uploads are permitted from here on.
      setStep("creds");
      setBusy(null);
    }
  }

  async function finishCreds() {
    setBusy("creds");
    setError(false);
    const ok = await post({
      intent: "sell",
      ...(experience !== null ? { experienceYears: experience } : {}),
      ...(portfolio.length ? { portfolioUrls: portfolio } : {}),
    });
    if (!ok) {
      setError(true);
      setBusy(null);
      return;
    }
    window.location.href = gigWizard;
  }

  if (step === "creds") {
    const bands = [
      { value: 0, label: t("exp0") },
      { value: 1, label: t("exp1") },
      { value: 3, label: t("exp3") },
      { value: 5, label: t("exp5") },
    ];
    return (
      <div className="flex w-full flex-col gap-4">
        <FormSection title={t("expTitle")}>
          <div className="flex flex-wrap gap-2">
            {bands.map((b) => (
              <button
                key={b.value}
                type="button"
                aria-pressed={experience === b.value}
                onClick={() => setExperience(b.value)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  experience === b.value
                    ? "border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </FormSection>

        <FormSection title={t("portfolioTitle")} desc={t("portfolioHint")}>
          <GalleryUpload value={portfolio} onChange={setPortfolio} prefix="portfolio" video />
        </FormSection>

        {error && <p role="alert" className="text-sm text-[hsl(var(--danger))]">{t("error")}</p>}

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={finishCreds}
            disabled={busy === "creds"}
            className="rounded-xl bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] disabled:opacity-60"
          >
            {busy === "creds" ? "…" : t("continueBtn")}
          </button>
          <a href={gigWizard} className="text-sm text-[hsl(var(--muted-foreground))] hover:underline">
            {t("skipForNow")}
          </a>
        </div>
      </div>
    );
  }

  const cards = [
    { intent: "buy" as const, icon: Briefcase, title: t("hire"), desc: t("hireDesc") },
    { intent: "sell" as const, icon: Palette, title: t("offer"), desc: t("offerDesc") },
  ];

  return (
    <div className="flex w-full flex-col gap-4">
      <FormSection title={t("nameSection")}>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-left">
            <span className="text-sm font-medium">{t("nameFirst")}</span>
            <input className={fieldClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} />
          </label>
          <label className="flex flex-col gap-1 text-left">
            <span className="text-sm font-medium">{t("nameLast")}</span>
            <input className={fieldClass} value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} />
          </label>
        </div>
      </FormSection>

      {cards.map(({ intent, icon: Icon, title, desc }) => (
        <button
          key={intent}
          onClick={() => choose(intent)}
          disabled={busy !== null || firstName.trim().length === 0}
          className="group flex items-center gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left shadow-[var(--shadow-soft)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[hsl(var(--primary))] hover:shadow-[var(--shadow-hover)] disabled:pointer-events-none disabled:opacity-60"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary-ink))]">
            <Icon size={20} strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {title}
              {busy === intent ? " …" : ""}
            </span>
            <span className="block text-sm text-[hsl(var(--muted-foreground))]">{desc}</span>
          </span>
          <ChevronRight
            className="h-5 w-5 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform group-hover:translate-x-0.5 group-hover:text-[hsl(var(--primary-ink))]"
            strokeWidth={2}
            aria-hidden
          />
        </button>
      ))}
      {error && <p role="alert" className="text-sm text-[hsl(var(--danger))]">{t("error")}</p>}
    </div>
  );
}
