"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { MediaUpload } from "@/components/media-upload";

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

export function GigForm({ locale, categories }: { locale: string; categories: Category[] }) {
  const t = useTranslations("Gig");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined);
  const [pkgs, setPkgs] = useState<Record<Tier, PkgState>>({
    BASIC: { ...emptyPkg },
    STANDARD: { ...emptyPkg },
    PREMIUM: { ...emptyPkg },
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setPkg(tier: Tier, field: keyof PkgState, value: string) {
    setPkgs((p) => ({ ...p, [tier]: { ...p[tier], [field]: value } }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
      const r = await fetch("/api/gigs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          coverUrl,
          categoryId: categoryId || undefined,
          tags: tags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 8),
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
    <form onSubmit={submit} className="flex flex-col gap-5">
      <MediaUpload value={coverUrl} onChange={setCoverUrl} />

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

      <Button type="submit" size="lg" disabled={busy}>
        {busy ? t("publishing") : t("publish")}
      </Button>
    </form>
  );
}
