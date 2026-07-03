import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { listPublicGigs, type GigSort } from "@/server/services/gig";
import { getCurrentUser } from "@/lib/session";
import { listSavedGigIds } from "@/server/services/saved";
import { GigCard } from "@/components/gig-card";
import { RecentlyViewed } from "@/components/recently-viewed";
import { listSavedSearches, searchLink } from "@/server/services/saved-search";
import { SaveSearchButton, DeleteSavedSearch } from "@/components/saved-search-controls";
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

  const field =
    "h-10 rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 text-sm";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-5 text-3xl font-bold">{tn("explore")}</h1>

      {/* Filter bar — plain GET form, URL-driven */}
      <form
        method="get"
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"
      >
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder={tg("searchPh")}
          aria-label={tg("searchPh")}
          className={`${field} min-w-48 flex-1`}
        />
        <select name="category" defaultValue={sp.category ?? ""} className={field} aria-label={tg("category")}>
          <option value="">{tg("allCategories")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c[nameKey]}
            </option>
          ))}
        </select>
        <input
          name="min"
          inputMode="numeric"
          defaultValue={sp.min ?? ""}
          placeholder={tg("minPrice")}
          aria-label={tg("minPrice")}
          className={`${field} w-28`}
        />
        <input
          name="max"
          inputMode="numeric"
          defaultValue={sp.max ?? ""}
          placeholder={tg("maxPrice")}
          aria-label={tg("maxPrice")}
          className={`${field} w-28`}
        />
        <select name="sort" defaultValue={sort} className={field} aria-label={tg("sort")}>
          <option value="newest">{tg("sortNewest")}</option>
          <option value="popular">{tg("sortPopular")}</option>
          <option value="price_asc">{tg("sortPriceLow")}</option>
          <option value="price_desc">{tg("sortPriceHigh")}</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-md bg-[hsl(var(--primary))] px-5 text-sm font-medium text-[hsl(var(--primary-foreground))]"
        >
          {tg("apply")}
        </button>
        {me && hasFilters && <SaveSearchButton filters={currentFilters} />}
      </form>

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
        <p className="text-[hsl(var(--muted-foreground))]">{tg("noResults")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gigs.map((g) => (
            <li key={g.id}>
              <GigCard gig={g} locale={locale} saved={savedSet.has(g.id)} isGuest={!me} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
