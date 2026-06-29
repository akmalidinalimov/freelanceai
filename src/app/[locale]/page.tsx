import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { listPublicGigs } from "@/server/services/gig";
import { formatUzs } from "@/lib/utils";

// Rendered per-request: the featured row reads live gigs from the DB.
export const dynamic = "force-dynamic";

const CATEGORIES = [
  { key: "aiVideo", slug: "ai-video" },
  { key: "aiImage", slug: "ai-image" },
  { key: "aiAvatar", slug: "ai-avatar" },
  { key: "aiAds", slug: "ai-ads" },
  { key: "voiceover", slug: "voiceover" },
  { key: "branding", slug: "branding" },
] as const;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Enable static rendering for this locale.
  setRequestLocale(locale);
  const t = await getTranslations();
  const featured = await listPublicGigs({ take: 8 }).catch(() => []);

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 py-20 text-center">
        <span className="rounded-full bg-[hsl(var(--muted))] px-4 py-1 text-sm text-[hsl(var(--muted-foreground))]">
          {t("Brand.tagline")}
        </span>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          {t("Home.heroTitle")}
        </h1>
        <p className="max-w-2xl text-lg text-[hsl(var(--muted-foreground))]">
          {t("Home.heroSubtitle")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/gigs">
            <Button size="lg">{t("Home.ctaPrimary")}</Button>
          </Link>
          <Link href="/sell">
            <Button size="lg" variant="outline">
              {t("Home.ctaSecondary")}
            </Button>
          </Link>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12">
        <h2 className="mb-6 text-2xl font-semibold">
          {t("Home.categoriesTitle")}
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map(({ key, slug }) => (
            <Link
              key={key}
              href={`/gigs?category=${slug}`}
              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 text-center text-sm font-medium transition-colors hover:border-[hsl(var(--primary))]"
            >
              {t(`Categories.${key}`)}
            </Link>
          ))}
        </div>
      </section>

      {/* Popular gigs */}
      {featured.length > 0 && (
        <section className="py-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">{t("Home.popularTitle")}</h2>
            <Link href="/gigs" className="text-sm font-medium text-[hsl(var(--primary))] hover:underline">
              {t("Home.viewAll")}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((g) => {
              const from = g.packages[0]?.priceUzs ?? 0;
              const seller = g.seller.firstName ?? g.seller.name ?? g.seller.username ?? "";
              return (
                <Link
                  key={g.id}
                  href={`/gigs/${g.slug}`}
                  className="flex flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 transition-colors hover:border-[hsl(var(--primary))]"
                >
                  <div className="mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[hsl(var(--primary))]/15 to-[hsl(var(--accent))]/15 text-xl font-bold text-[hsl(var(--primary))]">
                    {g.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      g.title.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm font-medium">{g.title}</p>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{seller}</p>
                  <p className="mt-auto pt-2 text-sm font-semibold tabular-nums">
                    {t("Gig.from")} {formatUzs(from)} so&apos;m
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="py-12">
        <h2 className="mb-6 text-2xl font-semibold">
          {t("Home.howItWorksTitle")}
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className="rounded-lg border border-[hsl(var(--border))] p-6"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--primary))] font-bold text-[hsl(var(--primary-foreground))]">
                {step}
              </div>
              <h3 className="mb-1 font-semibold">{t(`Home.step${step}Title`)}</h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {t(`Home.step${step}Body`)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
