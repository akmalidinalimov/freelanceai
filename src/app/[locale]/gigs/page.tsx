import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { listPublicGigs, type GigSort } from "@/server/services/gig";
import { getCurrentUser } from "@/lib/session";
import { listSavedGigIds } from "@/server/services/saved";
import { formatUzs } from "@/lib/utils";
import { SaveHeart } from "@/components/save-heart";
import { RecentlyViewed } from "@/components/recently-viewed";
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

  const sort = (["newest", "price_asc", "price_desc"] as const).includes(sp.sort as GigSort)
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

  const field =
    "h-10 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-sm";

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
          className={`${field} w-28`}
        />
        <input
          name="max"
          inputMode="numeric"
          defaultValue={sp.max ?? ""}
          placeholder={tg("maxPrice")}
          className={`${field} w-28`}
        />
        <select name="sort" defaultValue={sort} className={field} aria-label={tg("sort")}>
          <option value="newest">{tg("sortNewest")}</option>
          <option value="price_asc">{tg("sortPriceLow")}</option>
          <option value="price_desc">{tg("sortPriceHigh")}</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-md bg-[hsl(var(--primary))] px-5 text-sm font-medium text-[hsl(var(--primary-foreground))]"
        >
          {tg("apply")}
        </button>
      </form>

      {!sp.q && !sp.category && <RecentlyViewed />}

      <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
        {gigs.length} {tg("results")}
      </p>

      {gigs.length === 0 ? (
        <p className="text-[hsl(var(--muted-foreground))]">{tg("noResults")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gigs.map((g) => {
            const from = g.packages[0]?.priceUzs ?? 0;
            const seller = g.seller.firstName ?? g.seller.name ?? g.seller.username ?? "";
            return (
              <Link
                key={g.id}
                href={`/gigs/${g.slug}`}
                className="relative flex flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition-colors hover:border-[hsl(var(--primary))]"
              >
                <SaveHeart gigId={g.id} locale={locale} initialSaved={savedSet.has(g.id)} isGuest={!me} />
                {g.featured && (
                  <span className="absolute left-2 top-2 z-10 rounded-full bg-[hsl(var(--primary))] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--primary-foreground))]">
                    ★ {tg("featured")}
                  </span>
                )}
                <div className="mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[hsl(var(--primary))]/15 to-[hsl(var(--accent))]/15 text-2xl font-bold text-[hsl(var(--primary))]">
                  {g.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    g.title.slice(0, 1).toUpperCase()
                  )}
                </div>
                <p className="line-clamp-2 font-medium">{g.title}</p>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{seller}</p>
                <p className="mt-auto pt-2 text-sm font-semibold tabular-nums">
                  {tg("from")} {formatUzs(from)} so&apos;m
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
