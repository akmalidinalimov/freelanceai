import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { listPublicGigs, type GigSort } from "@/server/services/gig";
import { getCurrentUser } from "@/lib/session";
import { listSavedGigIds } from "@/server/services/saved";
import { GigCard } from "@/components/gig-card";
import { GigFilters } from "@/components/gig-filters";
import { RecentlyViewed } from "@/components/recently-viewed";
import { listSavedSearches, searchLink } from "@/server/services/saved-search";
import { SaveSearchButton, DeleteSavedSearch } from "@/components/saved-search-controls";
import { EmptyState } from "@/components/empty-state";
import { X, SearchX } from "lucide-react";
import type { Locale } from "@/i18n/routing";

export default async function GigsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    category?: string;
    min?: string;
    max?: string;
    sort?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const tn = await getTranslations("Nav");
  const tg = await getTranslations("Gig");

  const sort = (["newest", "price_asc", "price_desc", "popular"] as const).includes(sp.sort as GigSort)
    ? (sp.sort as GigSort)
    : "newest";
  const minUzs = sp.min ? Number(sp.min) : undefined;
  const maxUzs = sp.max ? Number(sp.max) : undefined;

  const nameKey = ({ uz: "nameUz", ru: "nameRu", en: "nameEn" } as const)[locale as Locale];
  const categories = await prisma.category.findMany({ orderBy: { slug: "asc" } });
  const gigs = await listPublicGigs({
    q: sp.q,
    categorySlug: sp.category || undefined,
    minUzs: Number.isFinite(minUzs) ? minUzs : undefined,
    maxUzs: Number.isFinite(maxUzs) ? maxUzs : undefined,
    sort,
  });

  const me = await getCurrentUser().catch(() => null);
  const savedSet = me ? await listSavedGigIds(me.id) : new Set<string>();
  const savedSearches = me ? await listSavedSearches(me.id) : [];
  const hasFilters = Boolean(sp.q || sp.category || minUzs != null || maxUzs != null);
  const currentFilters = {
    q: sp.q || undefined,
    categorySlug: sp.category || undefined,
    minUzs: Number.isFinite(minUzs) ? minUzs : undefined,
    maxUzs: Number.isFinite(maxUzs) ? maxUzs : undefined,
  };

  const localizedCats = categories.map((c) => ({ slug: c.slug, name: c[nameKey] }));

  // Active-filter chips: each links to the same page with that filter dropped.
  const activeChips: { key: string; drop: string[]; label: string }[] = [];
  if (sp.q) activeChips.push({ key: "q", drop: ["q"], label: `“${sp.q}”` });
  if (sp.category) {
    const c = categories.find((x) => x.slug === sp.category);
    activeChips.push({ key: "category", drop: ["category"], label: c ? c[nameKey] : sp.category });
  }
  if (sp.min || sp.max) {
    activeChips.push({ key: "price", drop: ["min", "max"], label: `${sp.min ?? "0"}–${sp.max ?? "∞"} so'm` });
  }
  const hrefWithout = (drop: string[]) => {
    const query: Record<string, string> = {};
    for (const [k, v] of Object.entries({ q: sp.q, category: sp.category, min: sp.min, max: sp.max, sort: sp.sort })) {
      if (v && !drop.includes(k)) query[k] = v as string;
    }
    return { pathname: "/gigs" as const, query };
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display mb-5 text-3xl font-extrabold">{tn("explore")}</h1>

      <GigFilters
        categories={localizedCats}
        values={{ q: sp.q, category: sp.category, min: sp.min, max: sp.max, sort }}
      />

      {hasFilters && (
        <div className="mb-6 mt-3 flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <Link
              key={chip.key}
              href={hrefWithout(chip.drop)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1 text-xs font-medium transition-colors hover:border-[hsl(var(--primary))]"
            >
              {chip.label}
              <X className="h-3 w-3 text-[hsl(var(--muted-foreground))]" aria-hidden />
            </Link>
          ))}
          <Link href="/gigs" className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline">
            {tg("clearAll")}
          </Link>
          {me && <SaveSearchButton filters={currentFilters} />}
        </div>
      )}

      {savedSearches.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{tg("savedSearches")}:</span>
          {savedSearches.map((s) => (
            <span
              key={s.id}
              className="flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-xs"
            >
              <Link
                href={searchLink({
                  q: s.q ?? undefined,
                  categorySlug: s.categorySlug ?? undefined,
                  minUzs: s.minUzs ?? undefined,
                  maxUzs: s.maxUzs ?? undefined,
                })}
                className="hover:underline"
              >
                {s.q || s.categorySlug || `${s.minUzs ?? ""}–${s.maxUzs ?? ""}`}
              </Link>
              <DeleteSavedSearch id={s.id} />
            </span>
          ))}
        </div>
      )}

      {!sp.q && !sp.category && <RecentlyViewed />}

      <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
        {gigs.length} {tg("results")}
      </p>

      {gigs.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={tg("noResults")}
          {...(hasFilters ? { ctaLabel: tg("clearAll"), ctaHref: "/gigs" } : {})}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gigs.map((g) => (
            <GigCard
              key={g.id}
              gig={g}
              locale={locale}
              saved={savedSet.has(g.id)}
              isGuest={!me}
            />
          ))}
        </div>
      )}
    </div>
  );
}
