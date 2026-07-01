import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listPublicGigs, listFeaturedGigs } from "@/server/services/gig";
import { listFeaturedCreators } from "@/server/services/browse";
import { formatUzs } from "@/lib/utils";
import { HomeSearch } from "@/components/home-search";
import { CreatorCard } from "@/components/creator-card";

// Rendered per-request: the featured row reads live gigs from the DB.
export const dynamic = "force-dynamic";

const CATEGORIES = [
  { key: "aiVideo", slug: "ai-video", icon: "🎬" },
  { key: "aiImage", slug: "ai-image", icon: "🖼️" },
  { key: "aiAvatar", slug: "ai-avatar", icon: "🧑‍💼" },
  { key: "aiAds", slug: "ai-ads", icon: "📣" },
  { key: "voiceover", slug: "voiceover", icon: "🎙️" },
  { key: "branding", slug: "branding", icon: "✨" },
] as const;

function GigCard({
  g,
  fromLabel,
}: {
  g: Awaited<ReturnType<typeof listPublicGigs>>[number];
  fromLabel: string;
}) {
  const from = g.packages[0]?.priceUzs ?? 0;
  const seller = g.seller.firstName ?? g.seller.name ?? g.seller.username ?? "";
  return (
    <Link
      href={`/gigs/${g.slug}`}
      className="flex flex-col rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 transition-all hover:-translate-y-1 hover:border-[hsl(var(--primary))] hover:shadow-[0_18px_40px_-24px_rgba(11,18,32,0.35)]"
    >
      <div className="mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[hsl(var(--primary))]/15 to-[hsl(var(--accent))]/15 text-xl font-bold text-[hsl(var(--primary))]">
        {g.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={g.coverUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          g.title.slice(0, 1).toUpperCase()
        )}
      </div>
      <p className="line-clamp-2 text-sm font-medium">{g.title}</p>
      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{seller}</p>
      <p className="mt-auto pt-2 text-sm font-semibold tabular-nums">
        {fromLabel} {formatUzs(from)} so&apos;m
      </p>
    </Link>
  );
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const featured = await listPublicGigs({ take: 8 }).catch(() => []);
  const featuredGigs = await listFeaturedGigs(4).catch(() => []);
  const creators = await listFeaturedCreators(4).catch(() => []);
  const fromLabel = t("Gig.from");

  return (
    <div
      className="mx-auto max-w-6xl px-4"
      style={{
        backgroundImage:
          "radial-gradient(hsl(var(--primary) / 0.06) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      {/* Hero — AI search */}
      <section className="flex flex-col items-center gap-5 py-16 text-center sm:py-24">
        <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))]/10 px-4 py-1.5 text-xs font-semibold text-[hsl(var(--primary))]">
          ✦ {t("Brand.tagline")}
        </span>
        <h1 className="font-display max-w-3xl text-4xl font-extrabold leading-[1.05] sm:text-5xl">
          {t("Home.searchHeadline")}
        </h1>
        <p className="max-w-xl text-base text-[hsl(var(--muted-foreground))] sm:text-lg">
          {t("Home.searchSub")}
        </p>
        <HomeSearch />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t("Home.orBrowse")}{" "}
          <Link href="/gigs" className="font-semibold text-[hsl(var(--primary))] hover:underline">
            {t("Home.ctaPrimary")}
          </Link>{" "}
          ·{" "}
          <Link href="/sell" className="font-semibold text-[hsl(var(--primary))] hover:underline">
            {t("Home.ctaSecondary")}
          </Link>
        </p>
      </section>

      {/* Categories */}
      <section className="py-8">
        <h2 className="font-display mb-5 text-2xl font-bold">{t("Home.categoriesTitle")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map(({ key, slug, icon }) => (
            <Link
              key={key}
              href={`/gigs?category=${slug}`}
              className="flex flex-col items-start gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition-all hover:-translate-y-1 hover:border-[hsl(var(--primary))]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10 text-xl">
                {icon}
              </span>
              <span className="text-sm font-semibold">{t(`Categories.${key}`)}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-10">
        <h2 className="font-display mb-5 text-2xl font-bold">{t("Home.howItWorksTitle")}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((step) => (
            <div key={step} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
              <div className="font-display mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--foreground))] font-bold text-[hsl(var(--background))]">
                {step}
              </div>
              <h3 className="mb-1 font-semibold">{t(`Home.step${step}Title`)}</h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{t(`Home.step${step}Body`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured gigs */}
      {featuredGigs.length > 0 && (
        <section className="py-6">
          <h2 className="font-display mb-5 text-2xl font-bold">★ {t("Gig.featured")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredGigs.map((g) => (
              <GigCard key={g.id} g={g} fromLabel={fromLabel} />
            ))}
          </div>
        </section>
      )}

      {/* Popular gigs */}
      {featured.length > 0 && (
        <section className="py-10">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">{t("Home.popularTitle")}</h2>
            <Link href="/gigs" className="text-sm font-semibold text-[hsl(var(--primary))] hover:underline">
              {t("Home.viewAll")}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((g) => (
              <GigCard key={g.id} g={g} fromLabel={fromLabel} />
            ))}
          </div>
        </section>
      )}

      {/* Featured creators */}
      {creators.length > 0 && (
        <section className="py-10">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">{t("Home.featuredCreators")}</h2>
            <Link href="/creators" className="text-sm font-semibold text-[hsl(var(--primary))] hover:underline">
              {t("Home.viewAll")}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {creators.map((c, i) => (
              <CreatorCard key={c.username ?? i} creator={c} />
            ))}
          </div>
        </section>
      )}

      {/* Trust strip */}
      <section className="flex flex-wrap justify-center gap-2 py-12">
        {[t("Home.trustSecure"), t("Home.trustPayment"), t("Home.trustVerified"), t("Home.trustLangs")].map(
          (item) => (
            <span
              key={item}
              className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))]"
            >
              {item}
            </span>
          )
        )}
      </section>
    </div>
  );
}
