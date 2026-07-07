import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { specBySlug, specLabel, specSlug, SPECIALIZATIONS } from "@/lib/specializations";
import { listCreatorsBySpecialization } from "@/server/services/browse";
import { VerifiedBadge } from "@/components/verified-badge";
import { Stars } from "@/components/stars";
import { DotGridBackground } from "@/components/living-background/dot-grid";
import { ApplyThemeClass } from "@/components/apply-theme-class";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; spec: string }>;
}): Promise<Metadata> {
  const { locale, spec } = await params;
  const s = specBySlug(spec);
  if (!s) return {};
  const label = specLabel(s.key, locale);
  const t = await getTranslations({ locale, namespace: "Browse" });
  return { title: t("metaTitle", { spec: label }), description: t("metaDesc", { spec: label }) };
}

export default async function BrowseSpecPage({
  params,
}: {
  params: Promise<{ locale: string; spec: string }>;
}) {
  const { locale, spec } = await params;
  setRequestLocale(locale);
  const s = specBySlug(spec);
  if (!s) notFound();
  const t = await getTranslations("Browse");
  const tp = await getTranslations("Profile");
  const label = specLabel(s.key, locale);
  const creators = await listCreatorsBySpecialization(s.key);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: t("metaTitle", { spec: label }),
    description: t("metaDesc", { spec: label }),
  };
  const related = SPECIALIZATIONS.filter((x) => x.kind === s.kind && x.key !== s.key).slice(0, 8);

  return (
    <>
      <DotGridBackground />
      <ApplyThemeClass name="theme-d02" />
      <div className="theme-d02 mx-auto max-w-5xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href="/browse" className="text-sm font-medium text-[hsl(var(--primary-ink))] hover:underline">
        ← {t("allSpecs")}
      </Link>
      <h1 className="font-display mt-3 text-3xl font-extrabold">{t("heading", { spec: label })}</h1>
      <p className="mt-1 text-[hsl(var(--muted-foreground))]">{t("sub", { spec: label })}</p>

      {creators.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("noCreators")}</p>
          <Link
            href={`/search?q=${encodeURIComponent(label)}`}
            className="mt-3 inline-block rounded-xl bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))]"
          >
            {t("searchCta")}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((c, i) => {
            const inner = (
              <div className="flex h-full flex-col rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition-all hover:-translate-y-1 hover:border-[hsl(var(--primary))]">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[hsl(var(--primary))]/20 to-[hsl(var(--accent))]/20 text-lg font-bold text-[hsl(var(--primary-ink))]">
                    {c.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      c.name.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">{c.name}</span>
                      {c.verified && <VerifiedBadge label={tp("verified")} />}
                    </div>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {tp(`level.${c.level}`)}
                    </span>
                  </div>
                </div>
                {c.headline && <p className="mt-3 line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">{c.headline}</p>}
                {c.ratingCount > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs">
                    <Stars value={c.ratingAvg} />
                    <span className="font-medium tabular-nums">{c.ratingAvg.toFixed(1)}</span>
                    <span className="text-[hsl(var(--muted-foreground))]">({c.ratingCount})</span>
                  </div>
                )}
              </div>
            );
            return (
              <div key={c.username ?? i}>
                {c.username ? <Link href={`/creators/${c.username}`}>{inner}</Link> : inner}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-[hsl(var(--muted-foreground))]">{t("related")}</h2>
        <div className="flex flex-wrap gap-2">
          {related.map((r) => (
            <Link
              key={r.key}
              href={`/browse/${specSlug(r.key)}`}
              className="rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]"
            >
              {specLabel(r.key, locale)}
            </Link>
          ))}
        </div>
      </div>
      </div>
    </>
  );
}
