"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CoverUpload } from "@/components/cover-upload";
import { GalleryUpload } from "@/components/gallery-upload";
import { FocalPicker } from "@/components/focal-picker";
import { TagInput } from "@/components/ui/tag-input";
import { SPECIALIZATIONS } from "@/lib/specializations";

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

const TIERS: Tier[] = ["BASIC", "STANDARD", "PREMIUM"];

/** A tier is "in use" when the seller (or a draft) has typed anything into it. */
function pkgFilled(p: PkgState | undefined): boolean {
  return Boolean(p && (p.title.trim() || p.priceUzs.trim() || p.deliveryDays.trim()));
}

/**
 * Local autosave for the (long, phone-first) new-gig form: switching to Telegram or a
 * stray back-tap must never cost the seller their typing. Edit mode is excluded — the
 * server already holds that state.
 */
const DRAFT_KEY = "gig-form-draft:v1";

interface SavedDraft {
  title: string;
  description: string;
  categoryId: string;
  tags: string[];
  coverUrl?: string;
  coverFocal?: string;
  coverType?: "image" | "video";
  coverPoster?: string;
  coverDims?: { w: number; h: number };
  galleryUrls: string[];
  faq: { q: string; a: string }[];
  extras: { title: string; priceUzs: string; deliveryDays: string }[];
  reqPrompts: string[];
  pkgs: Record<Tier, PkgState>;
  visibleTiers: Tier[];
}

function loadSavedDraft(): SavedDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SavedDraft;
    // Only worth restoring when there is real typed content.
    const meaningful = d.title?.trim() || d.description?.trim() || TIERS.some((t2) => pkgFilled(d.pkgs?.[t2]));
    return meaningful ? d : null;
  } catch {
    return null;
  }
}

function clearSavedDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* private mode etc. — losing the autosave is acceptable */
  }
}

/** True when a restorable local draft exists — lets the new-gig page skip the wizard
 * and land straight on the form, so the seller actually SEES their restored work. */
export function hasSavedGigDraft(): boolean {
  return loadSavedDraft() !== null;
}

export interface GigInitial {
  title: string;
  description: string;
  categoryId: string;
  tags: string;
  coverUrl?: string;
  coverFocal?: string;
  coverType?: string;
  coverPosterUrl?: string;
  coverW?: number;
  coverH?: number;
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
  const [tags, setTags] = useState<string[]>(
    initial?.tags
      ? initial.tags.split(",").map((s) => s.trim()).filter(Boolean)
      : []
  );
  // Localized taxonomy labels as tag suggestions (skills + niches), so sellers pick real,
  // searchable terms instead of guessing — better discoverability + easier low-literacy input.
  const tagSuggestions = SPECIALIZATIONS.map((s) => (locale === "ru" ? s.ru : locale === "en" ? s.en : s.uz));
  const [coverUrl, setCoverUrl] = useState<string | undefined>(initial?.coverUrl);
  const [coverFocal, setCoverFocal] = useState<string | undefined>(initial?.coverFocal);
  const [coverType, setCoverType] = useState<"image" | "video" | undefined>(
    initial?.coverType === "video" ? "video" : initial?.coverUrl ? "image" : undefined
  );
  const [coverPoster, setCoverPoster] = useState<string | undefined>(initial?.coverPosterUrl);
  const [coverDims, setCoverDims] = useState<{ w: number; h: number } | undefined>(
    initial?.coverW && initial?.coverH ? { w: initial.coverW, h: initial.coverH } : undefined
  );
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
  // One package is enough to publish — start with just BASIC and let the seller opt
  // into more tiers, instead of facing a 3×4 input grid. Prefilled drafts (AI wizard,
  // edit mode) open every tier they actually use.
  const [visibleTiers, setVisibleTiers] = useState<Tier[]>(() => {
    const used = TIERS.filter((tier) => pkgFilled(initial?.packages?.[tier]));
    return used.length > 0 ? Array.from(new Set<Tier>(["BASIC", ...used])) : ["BASIC"];
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  // Restore a local autosave once, client-side only (no hydration mismatch). An AI-wizard
  // draft (`initial`) or edit mode (`gigId`) always wins over the autosave.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!gigId && !initial) {
      const saved = loadSavedDraft();
      if (saved) {
        setTitle(saved.title ?? "");
        setDescription(saved.description ?? "");
        setCategoryId(saved.categoryId ?? "");
        setTags(Array.isArray(saved.tags) ? saved.tags : []);
        setCoverUrl(saved.coverUrl);
        setCoverFocal(saved.coverFocal);
        setCoverType(saved.coverType);
        setCoverPoster(saved.coverPoster);
        setCoverDims(saved.coverDims);
        setGalleryUrls(Array.isArray(saved.galleryUrls) ? saved.galleryUrls : []);
        setFaq(Array.isArray(saved.faq) ? saved.faq : []);
        setExtras(Array.isArray(saved.extras) ? saved.extras : []);
        setReqPrompts(Array.isArray(saved.reqPrompts) ? saved.reqPrompts : []);
        setPkgs({
          BASIC: saved.pkgs?.BASIC ?? { ...emptyPkg },
          STANDARD: saved.pkgs?.STANDARD ?? { ...emptyPkg },
          PREMIUM: saved.pkgs?.PREMIUM ?? { ...emptyPkg },
        });
        setVisibleTiers(saved.visibleTiers?.length ? saved.visibleTiers : ["BASIC"]);
        setRestored(true);
      }
    }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave (new gigs only). Empty forms remove the key instead of storing noise.
  useEffect(() => {
    if (gigId || !hydrated.current) return;
    const id = setTimeout(() => {
      const meaningful = title.trim() || description.trim() || TIERS.some((t2) => pkgFilled(pkgs[t2]));
      if (!meaningful) {
        clearSavedDraft();
        return;
      }
      try {
        const draft: SavedDraft = {
          title, description, categoryId, tags, coverUrl, coverFocal, coverType,
          coverPoster, coverDims, galleryUrls, faq, extras, reqPrompts, pkgs, visibleTiers,
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        /* storage full/blocked — autosave is best-effort */
      }
    }, 400);
    return () => clearTimeout(id);
  }, [gigId, title, description, categoryId, tags, coverUrl, coverFocal, coverType, coverPoster, coverDims, galleryUrls, faq, extras, reqPrompts, pkgs, visibleTiers]);

  function discardRestored() {
    clearSavedDraft();
    setTitle("");
    setDescription("");
    setCategoryId("");
    setTags([]);
    setCoverUrl(undefined);
    setCoverFocal(undefined);
    setCoverType(undefined);
    setCoverPoster(undefined);
    setCoverDims(undefined);
    setGalleryUrls([]);
    setFaq([]);
    setExtras([]);
    setReqPrompts([]);
    setPkgs({ BASIC: { ...emptyPkg }, STANDARD: { ...emptyPkg }, PREMIUM: { ...emptyPkg } });
    setVisibleTiers(["BASIC"]);
    setRestored(false);
  }

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
    // Validate client-side so an empty delivery-days / too-low price gives a clear message here
    // instead of a raw server validation error after the round-trip.
    if (packages.some((p) => !Number.isFinite(p.priceUzs) || p.priceUzs < 1000)) {
      setError(t("pkgPriceInvalid"));
      return;
    }
    if (packages.some((p) => !Number.isFinite(p.deliveryDays) || p.deliveryDays < 1)) {
      setError(t("pkgDaysInvalid"));
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
          coverType: coverUrl ? coverType ?? "image" : undefined,
          coverPosterUrl: coverUrl && coverType === "video" ? coverPoster : undefined,
          coverFocal: coverUrl && coverType !== "video" ? coverFocal : undefined,
          coverW: coverUrl ? coverDims?.w : undefined,
          coverH: coverUrl ? coverDims?.h : undefined,
          galleryUrls,
          categoryId: categoryId || undefined,
          tags: tags.slice(0, 8),
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
        clearSavedDraft(); // the work is on the server now — don't re-offer it next visit
        // ?published=1 → the dashboard confirms the submission and sets expectations
        // (moderation → you'll be notified), instead of a silent landing.
        window.location.href = `/${locale}/dashboard/seller${!gigId && !draft ? "?published=1" : ""}`;
      } else {
        setError(j.error?.message ?? t("error"));
        setBusy(false);
      }
    } catch {
      setError(t("error"));
      setBusy(false);
    }
  }

  function addTier(tier: Tier) {
    setVisibleTiers((v) => (v.includes(tier) ? v : TIERS.filter((t2) => v.includes(t2) || t2 === tier)));
  }
  function removeTier(tier: Tier) {
    setPkgs((p) => ({ ...p, [tier]: { ...emptyPkg } })); // cleared values never reach submit
    setVisibleTiers((v) => v.filter((t2) => t2 !== tier));
  }

  const field =
    "w-full rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 py-2 text-sm";
  const tierLabel: Record<Tier, string> = {
    BASIC: t("basic"),
    STANDARD: t("standard"),
    PREMIUM: t("premium"),
  };

  return (
    <form onSubmit={(e) => submit(e, false)} className="flex flex-col gap-5 pb-24">
      {restored && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/8 px-4 py-2.5 text-sm"
        >
          <span className="text-[hsl(var(--primary-ink))]">{t("draftRestored")}</span>
          <button
            type="button"
            onClick={discardRestored}
            className="shrink-0 font-medium text-[hsl(var(--muted-foreground))] underline hover:text-[hsl(var(--foreground))]"
          >
            {t("draftDiscard")}
          </button>
        </div>
      )}

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
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t("tags")}</span>
              <TagInput
                value={tags}
                onChange={setTags}
                suggestions={tagSuggestions}
                placeholder={t("tagsPh")}
                ariaLabel={t("tags")}
                max={8}
              />
            </div>
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
          <CoverUpload
            value={
              coverUrl
                ? { url: coverUrl, type: coverType ?? "image", poster: coverPoster, w: coverDims?.w, h: coverDims?.h }
                : undefined
            }
            onChange={(v) => {
              setCoverUrl(v?.url);
              setCoverType(v?.type);
              setCoverPoster(v?.poster);
              setCoverDims(v?.w && v?.h ? { w: v.w, h: v.h } : undefined);
              if (!v) setCoverFocal(undefined); // clearing the cover resets its framing
            }}
          />
          {/* Focal point only matters for image covers cropped into the 16:9 frame. */}
          {coverUrl && coverType !== "video" && (
            <FocalPicker src={coverUrl} value={coverFocal} onChange={setCoverFocal} />
          )}
          <GalleryUpload value={galleryUrls} onChange={setGalleryUrls} />
        </div>
      </Section>

      {/* 3 — Packages: the money (required). One tier is enough; more are opt-in. */}
      <Section title={t("packages")} desc={t("packagesDesc")}>
        <div
          className={
            visibleTiers.length === 1
              ? "grid gap-4 sm:max-w-sm"
              : visibleTiers.length === 2
                ? "grid gap-4 sm:grid-cols-2"
                : "grid gap-4 sm:grid-cols-3"
          }
        >
          {TIERS.filter((tier) => visibleTiers.includes(tier)).map((tier) => (
            <div key={tier} className="rounded-xl border border-[hsl(var(--border))] p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold">{tierLabel[tier]}</p>
                {tier !== "BASIC" && (
                  <button
                    type="button"
                    aria-label={`${t("pkgRemoveTier")} — ${tierLabel[tier]}`}
                    onClick={() => removeTier(tier)}
                    className="rounded-md border border-[hsl(var(--border))] px-2 text-sm text-[hsl(var(--muted-foreground))]"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  className={field}
                  placeholder={t("pkgTitle")}
                  aria-label={`${tierLabel[tier]} — ${t("pkgTitle")}`}
                  value={pkgs[tier].title}
                  onChange={(e) => setPkg(tier, "title", e.target.value)}
                />
                {/* Numeric inputs select their content on focus so a prefilled value
                    (e.g. revisions "1") is REPLACED by typing, never appended ("11"). */}
                <input
                  className={field}
                  inputMode="numeric"
                  placeholder={`${t("price")} (so'm)`}
                  aria-label={`${tierLabel[tier]} — ${t("price")} (so'm)`}
                  value={pkgs[tier].priceUzs}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setPkg(tier, "priceUzs", e.target.value.replace(/\D/g, ""))}
                />
                <input
                  className={field}
                  inputMode="numeric"
                  placeholder={t("deliveryDays")}
                  aria-label={`${tierLabel[tier]} — ${t("deliveryDays")}`}
                  value={pkgs[tier].deliveryDays}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setPkg(tier, "deliveryDays", e.target.value.replace(/\D/g, ""))}
                />
                <input
                  className={field}
                  inputMode="numeric"
                  placeholder={t("revisions")}
                  aria-label={`${tierLabel[tier]} — ${t("revisions")}`}
                  value={pkgs[tier].revisions}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setPkg(tier, "revisions", e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
          ))}
        </div>
        {visibleTiers.length < TIERS.length && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {TIERS.filter((tier) => !visibleTiers.includes(tier)).map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => addTier(tier)}
                className="rounded-full border border-dashed border-[hsl(var(--border))] px-3 py-1 text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary-ink))]"
              >
                + {t("pkgAddTier", { tier: tierLabel[tier] })}
              </button>
            ))}
          </div>
        )}
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
            <div className="flex flex-col gap-2">
              {/* One-tap common extras — the biggest average-order-value lever, made effortless
                  for a manual-form seller who wouldn't know what add-ons to offer. */}
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["extraFastDelivery", 15000],
                    ["extraSourceFiles", 20000],
                    ["extraRevision", 10000],
                    ["extraCommercial", 30000],
                  ] as const
                )
                  .filter(([key]) => !extras.some((e) => e.title === t(key)))
                  .map(([key, price]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setExtras((arr) =>
                          arr.length < 6 ? [...arr, { title: t(key), priceUzs: String(price), deliveryDays: "" }] : arr
                        )
                      }
                      className="rounded-full border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/[0.06] px-3 py-1 text-xs font-medium text-[hsl(var(--primary-ink))]"
                    >
                      + {t(key)}
                    </button>
                  ))}
              </div>
              <button
                type="button"
                onClick={() => setExtras((arr) => [...arr, { title: "", priceUzs: "", deliveryDays: "" }])}
                className="self-start rounded-md border border-dashed border-[hsl(var(--border))] px-3 py-1 text-sm text-[hsl(var(--muted-foreground))]"
              >
                + {t("extraAdd")}
              </button>
            </div>
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
