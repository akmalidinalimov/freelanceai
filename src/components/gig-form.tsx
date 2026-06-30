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
    "w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm";
  const tiers: Tier[] = ["BASIC", "STANDARD", "PREMIUM"];
  const tierLabel: Record<Tier, string> = {
    BASIC: t("basic"),
    STANDARD: t("standard"),
    PREMIUM: t("premium"),
  };

  return (
    <form onSubmit={(e) => submit(e, false)} className="flex flex-col gap-5">
      <MediaUpload value={coverUrl} onChange={setCoverUrl} />
      <GalleryUpload value={galleryUrls} onChange={setGalleryUrls} />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("titleLabel")}</span>
        <input
          className={field}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("titlePh")}
          minLength={5}
          maxLength={80}
          required
        />
      </label>

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

      <div>
        <p className="mb-2 text-sm font-medium">{t("faq")}</p>
        <div className="flex flex-col gap-2">
          {faq.map((f, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-lg border border-[hsl(var(--border))] p-2">
              <div className="flex gap-2">
                <input
                  className={field}
                  placeholder={t("faqQ")}
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
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t("extras")}</p>
        <div className="flex flex-col gap-2">
          {extras.map((e, i) => (
            <div key={i} className="flex flex-wrap gap-2 rounded-lg border border-[hsl(var(--border))] p-2">
              <input
                className={`${field} flex-1`}
                placeholder={t("extraTitle")}
                value={e.title}
                onChange={(ev) => setExtras((arr) => arr.map((x, j) => (j === i ? { ...x, title: ev.target.value } : x)))}
              />
              <input
                className={`${field} w-28`}
                inputMode="numeric"
                placeholder={`${t("price")} (so'm)`}
                value={e.priceUzs}
                onChange={(ev) => setExtras((arr) => arr.map((x, j) => (j === i ? { ...x, priceUzs: ev.target.value.replace(/\D/g, "") } : x)))}
              />
              <input
                className={`${field} w-24`}
                inputMode="numeric"
                placeholder={t("extraDays")}
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
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t("requirements")}</p>
        <div className="flex flex-col gap-2">
          {reqPrompts.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={`${field} flex-1`}
                placeholder={t("requirementQ")}
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
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t("packages")}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {tiers.map((tier) => (
            <div key={tier} className="rounded-xl border border-[hsl(var(--border))] p-4">
              <p className="mb-2 font-semibold">{tierLabel[tier]}</p>
              <div className="flex flex-col gap-2">
                <input
                  className={field}
                  placeholder={t("pkgTitle")}
                  value={pkgs[tier].title}
                  onChange={(e) => setPkg(tier, "title", e.target.value)}
                />
                <input
                  className={field}
                  inputMode="numeric"
                  placeholder={`${t("price")} (so'm)`}
                  value={pkgs[tier].priceUzs}
                  onChange={(e) => setPkg(tier, "priceUzs", e.target.value.replace(/\D/g, ""))}
                />
                <input
                  className={field}
                  inputMode="numeric"
                  placeholder={t("deliveryDays")}
                  value={pkgs[tier].deliveryDays}
                  onChange={(e) => setPkg(tier, "deliveryDays", e.target.value.replace(/\D/g, ""))}
                />
                <input
                  className={field}
                  inputMode="numeric"
                  placeholder={t("revisions")}
                  value={pkgs[tier].revisions}
                  onChange={(e) => setPkg(tier, "revisions", e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{t("packagesHint")}</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
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
