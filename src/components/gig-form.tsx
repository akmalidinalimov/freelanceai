"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { MediaUpload } from "@/components/media-upload";
import { GalleryUpload } from "@/components/gallery-upload";

interface Category {
  id: string;
  name: string;
}
type Tier = "BASIC" | "STANDARD" | "PREMIUM";
interface PkgState {
  title: string;
  priceUzs: string;
  deliveryDays: string;
  revisions: string;
}

const emptyPkg: PkgState = { title: "", priceUzs: "", deliveryDays: "", revisions: "1" };

export interface GigInitial {
  title: string;
  description: string;
  categoryId: string;
  tags: string;
  coverUrl?: string;
  galleryUrls: string[];
  faq: { q: string; a: string }[];
  extras: { title: string; priceUzs: string; deliveryDays: string }[];
  requirementPrompts: string[];
  packages: Partial<Record<Tier, PkgState>>;
}

/** A titled form section card — turns the long gig form into digestible, labelled chunks. */
function Section({
  title,
  desc,
  optional,
  children,
}: {
  title: string;
  desc?: string;
  optional?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-display font-bold">{title}</h2>
          {optional && (
            <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
              {optional}
            </span>
          )}
        </div>
        {desc && <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

export function GigForm({
  locale,
  categories,
  gigId,
  initial,
}: {
  locale: string;
  categories: Category[];
  gigId?: string;
  initial?: GigInitial;
}) {
  const t = useTranslations("Gig");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [tags, setTags] = useState(initial?.tags ?? "");
  const [coverUrl, setCoverUrl] = useState<string | undefined>(initial?.coverUrl);
  const [galleryUrls, setGalleryUrls] = useState<string[]>(initial?.galleryUrls ?? []);
  const [faq, setFaq] = useState<{ q: string; a: string }[]>(initial?.faq ?? []);
  const [extras, setExtras] = useState<{ title: string; priceUzs: string; deliveryDays: string }[]>(
    initial?.extras ?? []
  );
  const [reqPrompts, setReqPrompts] = useState<string[]>(initial?.requirementPrompts ?? []);
  const [pkgs, setPkgs] = useState<Record<Tier, PkgState>>(() => ({
    BASIC: initial?.packages?.BASIC ?? { ...emptyPkg },
    STANDARD: initial?.packages?.STANDARD ?? { ...emptyPkg },
    PREMIUM: initial?.packages?.PREMIUM ?? { ...emptyPkg },
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setPkg(tier: Tier, field: keyof PkgState, value: string) {
    setPkgs((p) => ({ ...p, [tier]: { ...p[tier], [field]: value } }));
  }

  async function submit(e: React.FormEvent | null, draft = false) {
    e?.preventDefault();
    setError(null);

    const packages = (Object.keys(pkgs) as Tier[])
      .filter((tier) => pkgs[tier].priceUzs.trim() !== "")
      .map((tier) => ({
        tier,
        title: pkgs[tier].title.trim() || tier,
        priceUzs: Number(pkgs[tier].priceUzs),
        deliveryDays: Number(pkgs[tier].deliveryDays),
        revisions: Number(pkgs[tier].revisions || 0),
      }));

    if (packages.length === 0) {
      setError(t("needPackage"));
      return;
    }

    setBusy(true);
    try {
      const r = await fetch(gigId ? `/api/gigs/${gigId}` : "/api/gigs", {
        method: gigId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          coverUrl,
          galleryUrls,
          categoryId: categoryId || undefined,
          tags: tags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 8),
          faq:
            faq
              .map((f) => ({ q: f.q.trim(), a: f.a.trim() }))
              .filter((f) => f.q && f.a)
              .slice(0, 10) || undefined,
          extras: extras
            .map((e) => ({
              title: e.title.trim(),
              priceUzs: Number(e.priceUzs),
              deliveryDays: Number(e.deliveryDays || 0),
            }))
            .filter((e) => e.title && e.priceUzs >= 1000)
            .slice(0, 6),
          requirementPrompts: reqPrompts.map((p) => p.trim()).filter(Boolean).slice(0, 8),
          draft: gigId ? undefined : draft,
          packages,
        }),
      });
      const j = await r.json();
      if (j.ok) {
        window.location.href = `/${locale}/dashboard/seller`;
      } else {
        setError(j.error?.message ?? t("error"));
        setBusy(false);
      }
    } catch {
      setError(t("error"));
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 py-2 text-sm";
  const tiers: Tier[] = ["BASIC", "STANDARD", "PREMIUM"];
  const tierLabel: Record<Tier, string> = {
    BASIC: t("basic"),
    STANDARD: t("standard"),
    PREMIUM: t("premium"),
  };

  return (
    <form onSubmit={(e) => submit(e, false)} className="flex flex-col gap-5 pb-24">
      {/* 1 — Overview: the essentials a buyer reads first */}
      <Section title={t("secOverview")}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="flex items-center justify-between text-sm font-medium">
              {t("titleLabel")}
              <span className="tabular-nums text-xs font-normal text-[hsl(var(--muted-foreground))]">
                {title.length}/80
              </span>
            </span>
            <input
              className={field}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("titlePh")}
              minLength={5}
              maxLength={80}
              required
            />
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{t("titleHint")}</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t("category")}</span>
              <select className={field} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t("tags")}</span>
              <input
                className={field}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={t("tagsPh")}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("descLabel")}</span>
            <textarea
              className={`${field} min-h-32`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descPh")}
              minLength={20}
              required
            />
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{t("descHint")}</span>
          </label>
        </div>
      </Section>

      {/* 2 — Media: the first visual impression */}
      <Section title={t("secMedia")} desc={t("mediaHint")}>
        <div className="flex flex-col gap-4">
          <MediaUpload value={coverUrl} onChange={setCoverUrl} />
          <GalleryUpload value={galleryUrls} onChange={setGalleryUrls} />
        </div>
      </Section>

      {/* 3 — Packages: the money (required) */}
      <Section title={t("packages")} desc={t("packagesDesc")}>
        <div className="grid gap-4 sm:grid-cols-3">
          {tiers.map((tier) => (
            <div key={tier} className="rounded-xl border border-[hsl(var(--border))] p-4">
              <p className="mb-2 font-semibold">{tierLabel[tier]}</p>
              <div className="flex flex-col gap-2">
                <input
                  className={field}
                  placeholder={t("pkgTitle")}
                  aria-label={`${tierLabel[tier]} — ${t("pkgTitle")}`}
                  value={pkgs[tier].title}
                  onChange={(e) => setPkg(tier, "title", e.target.value)}
                />
                <input
                  className={field}
                  inputMode="numeric"
                  placeholder={`${t("price")} (so'm)`}
                  aria-label={`${tierLabel[tier]} — ${t("price")} (so'm)`}
                  value={pkgs[tier].priceUzs}
                  onChange={(e) => setPkg(tier, "priceUzs", e.target.value.replace(/\D/g, ""))}
                />
                <input
                  className={field}
                  inputMode="numeric"
                  placeholder={t("deliveryDays")}
                  aria-label={`${tierLabel[tier]} — ${t("deliveryDays")}`}
                  value={pkgs[tier].deliveryDays}
                  onChange={(e) => setPkg(tier, "deliveryDays", e.target.value.replace(/\D/g, ""))}
                />
                <input
                  className={field}
                  inputMode="numeric"
                  placeholder={t("revisions")}
                  aria-label={`${tierLabel[tier]} — ${t("revisions")}`}
                  value={pkgs[tier].revisions}
                  onChange={(e) => setPkg(tier, "revisions", e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{t("packagesHint")}</p>
      </Section>

      {/* 4 — Extras (optional) */}
      <Section title={t("extras")} desc={t("extrasDesc")} optional={t("optional")}>
        <div className="flex flex-col gap-2">
          {extras.map((e, i) => (
            <div key={i} className="flex flex-wrap gap-2 rounded-lg border border-[hsl(var(--border))] p-2">
              <input
                className={`${field} flex-1`}
                placeholder={t("extraTitle")}
                aria-label={t("extraTitle")}
                value={e.title}
                onChange={(ev) => setExtras((arr) => arr.map((x, j) => (j === i ? { ...x, title: ev.target.value } : x)))}
              />
              <input
                className={`${field} w-28`}
                inputMode="numeric"
                placeholder={`${t("price")} (so'm)`}
                aria-label={`${t("price")} (so'm)`}
                value={e.priceUzs}
                onChange={(ev) => setExtras((arr) => arr.map((x, j) => (j === i ? { ...x, priceUzs: ev.target.value.replace(/\D/g, "") } : x)))}
              />
              <input
                className={`${field} w-24`}
                inputMode="numeric"
                placeholder={t("extraDays")}
                aria-label={t("extraDays")}
                value={e.deliveryDays}
                onChange={(ev) => setExtras((arr) => arr.map((x, j) => (j === i ? { ...x, deliveryDays: ev.target.value.replace(/\D/g, "") } : x)))}
              />
              <button
                type="button"
                aria-label={t("faqRemove")}
                onClick={() => setExtras((arr) => arr.filter((_, j) => j !== i))}
                className="shrink-0 rounded-md border border-[hsl(var(--border))] px-2 text-sm"
              >
                ×
              </button>
            </div>
          ))}
          {extras.length < 6 && (
            <button
              type="button"
              onClick={() => setExtras((arr) => [...arr, { title: "", priceUzs: "", deliveryDays: "" }])}
              className="self-start rounded-md border border-dashed border-[hsl(var(--border))] px-3 py-1 text-sm text-[hsl(var(--muted-foreground))]"
            >
              + {t("extraAdd")}
            </button>
          )}
        </div>
      </Section>

      {/* 5 — Requirements (optional) */}
      <Section title={t("requirements")} desc={t("requirementsDesc")} optional={t("optional")}>
        <div className="flex flex-col gap-2">
          {reqPrompts.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={`${field} flex-1`}
                placeholder={t("requirementQ")}
                aria-label={t("requirementQ")}
                value={p}
                onChange={(e) => setReqPrompts((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <button
                type="button"
                aria-label={t("faqRemove")}
                onClick={() => setReqPrompts((arr) => arr.filter((_, j) => j !== i))}
                className="shrink-0 rounded-md border border-[hsl(var(--border))] px-2 text-sm"
              >
                ×
              </button>
            </div>
          ))}
          {reqPrompts.length < 8 && (
            <button
              type="button"
              onClick={() => setReqPrompts((arr) => [...arr, ""])}
              className="self-start rounded-md border border-dashed border-[hsl(var(--border))] px-3 py-1 text-sm text-[hsl(var(--muted-foreground))]"
            >
              + {t("requirementAdd")}
            </button>
          )}
        </div>
      </Section>

      {/* 6 — FAQ (optional) */}
      <Section title={t("faq")} desc={t("faqDesc")} optional={t("optional")}>
        <div className="flex flex-col gap-2">
          {faq.map((f, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-lg border border-[hsl(var(--border))] p-2">
              <div className="flex gap-2">
                <input
                  className={field}
                  placeholder={t("faqQ")}
                  aria-label={t("faqQ")}
                  value={f.q}
                  onChange={(e) => setFaq((arr) => arr.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))}
                />
                <button
                  type="button"
                  aria-label={t("faqRemove")}
                  onClick={() => setFaq((arr) => arr.filter((_, j) => j !== i))}
                  className="shrink-0 rounded-md border border-[hsl(var(--border))] px-2 text-sm"
                >
                  ×
                </button>
              </div>
              <textarea
                className={`${field} min-h-16`}
                placeholder={t("faqA")}
                aria-label={t("faqA")}
                value={f.a}
                onChange={(e) => setFaq((arr) => arr.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
              />
            </div>
          ))}
          {faq.length < 10 && (
            <button
              type="button"
              onClick={() => setFaq((arr) => [...arr, { q: "", a: "" }])}
              className="self-start rounded-md border border-dashed border-[hsl(var(--border))] px-3 py-1 text-sm text-[hsl(var(--muted-foreground))]"
            >
              + {t("faqAdd")}
            </button>
          )}
        </div>
      </Section>

      {error && <p className="text-sm text-[hsl(var(--danger))]">{error}</p>}

      {/* Sticky action bar — the submit/draft CTAs stay reachable in this long form */}
      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]/75">
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? t("publishing") : gigId ? t("saveChanges") : t("publish")}
        </Button>
        {!gigId && (
          <Button type="button" size="lg" variant="outline" disabled={busy} onClick={() => submit(null, true)}>
            {t("saveDraft")}
          </Button>
        )}
      </div>
    </form>
  );
}
