import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listFeaturedCreators } from "@/server/services/browse";
import { listFeaturedGigs, listPublicGigs } from "@/server/services/gig";
import { specSlug, specLabel } from "@/lib/specializations";
import { HomeSearch } from "@/components/home-search";
import { FeaturedMarquee, type MarqueeGig } from "@/components/home/featured-marquee";
import { AbstractCategories, type HomeCategory } from "@/components/home/abstract-categories";
import { CreatorCard } from "@/components/creator-card";
import { cardClass } from "@/components/ui/card";

export const dynamic = "force-dynamic";

// Bento categories (flagship first) → each links to the gigs for that specialization.
const CATS = [
  { spec: "ai_video", desc: "catVideo" },
  { spec: "product_photo", desc: "catPhoto" },
  { spec: "branding", desc: "catBranding" },
  { spec: "ai_avatar", desc: "catAvatar" },
  { spec: "voiceover", desc: "catVoice" },
  { spec: "motion", desc: "catMotion" },
] as const;

type GigWithSeller = {
  slug: string; title: string; coverUrl: string | null; coverPosterUrl: string | null;
  featured: boolean;
  salesCount: number;
  packages: { priceUzs: number }[];
  _count: { orders: number };
  seller: {
    firstName: string | null; name: string | null; username: string | null;
    image: string | null; photoUrl: string | null;
    sellerProfile: { ratingAvg: number; ratingCount: number } | null;
  };
};

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const creators = await listFeaturedCreators(8).catch(() => []);

  // Featured gigs with a cover; backfill with newest covered gigs so the strip is never thin.
  const toGig = (g: GigWithSeller): MarqueeGig => ({
    slug: g.slug,
    title: g.title,
    coverUrl: g.coverUrl,
    coverPosterUrl: g.coverPosterUrl ?? null,
    username: g.seller.username,
    sellerName: g.seller.firstName ?? g.seller.name ?? g.seller.username ?? "",
    sellerAvatar: g.seller.image ?? g.seller.photoUrl ?? null,
    verified: Boolean(g.seller.username && g.seller.sellerProfile),
    featured: g.featured,
    priceUzs: g.packages[0]?.priceUzs ?? 0,
    orders: Math.max(g.salesCount, g._count.orders),
    ratingAvg: g.seller.sellerProfile?.ratingAvg ?? 0,
    ratingCount: g.seller.sellerProfile?.ratingCount ?? 0,
  });
  const featuredGigs = (await listFeaturedGigs(8).catch(() => []))
    .filter((g) => g.coverUrl)
    .map(toGig);
  if (featuredGigs.length < 6) {
    const seen = new Set(featuredGigs.map((g) => g.slug));
    const backfill = (await listPublicGigs({ take: 12 }).catch(() => []))
      .filter((g) => g.coverUrl && !seen.has(g.slug))
      .map(toGig);
    featuredGigs.push(...backfill);
  }
  const showcaseGigs = featuredGigs.slice(0, 8);

  const cats: HomeCategory[] = CATS.map((c) => ({
    href: `/browse/${specSlug(c.spec)}`,
    name: specLabel(c.spec, locale),
    sub: t(c.desc),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* HERO — copy + the real AI concierge search (typewriter + inline results) */}
      <section className="pt-10 pb-8 sm:pt-14">
        <div className="mx-auto max-w-3xl text-center sm:text-left">
          <h1 className="font-display text-[clamp(2.2rem,5.6vw,4rem)] font-bold leading-[1.08] tracking-[-0.02em] text-balance">
            {t("heroTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-[52ch] text-lg text-[hsl(var(--muted-foreground))] sm:mx-0">
            {t("heroSubtitle")}
          </p>
        </div>
        <div className="mt-7">
          <HomeSearch />
        </div>
      </section>

      {/* FEATURED — auto-moving, rotating, tap-to-pause strip of real gigs */}
      {showcaseGigs.length > 0 && (
        <section className="py-8">
          <div className="mb-4 flex items-baseline justify-between px-1">
            <h2 className="font-display text-xl font-bold sm:text-2xl">{t("workWall")}</h2>
            <Link href="/gigs" className="text-sm font-semibold text-[hsl(var(--primary-ink))] hover:underline">
              {t("viewAll")}
            </Link>
          </div>
          <FeaturedMarquee gigs={showcaseGigs} />
        </section>
      )}

      {/* CATEGORIES — abstract bento, each tile → gigs for that specialization */}
      <section className="py-8">
        <div className="mb-4 flex items-baseline justify-between px-1">
          <h2 className="font-display text-xl font-bold sm:text-2xl">{t("categoriesTitle")}</h2>
          <Link href="/browse" className="text-sm font-semibold text-[hsl(var(--primary-ink))] hover:underline">
            {t("viewAll")}
          </Link>
        </div>
        <AbstractCategories cats={cats} />
      </section>

      {/* HOW IT WORKS */}
      <section className="py-8">
        <h2 className="font-display mb-4 text-xl font-bold sm:text-2xl">{t("howItWorksTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((step) => (
            <div key={step} className={cardClass(false, "flex items-start gap-3 p-5")}>
              <div className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))] font-bold text-[hsl(var(--primary-foreground))]">
                {step}
              </div>
              <div>
                <h3 className="font-bold">{t(`step${step}Title`)}</h3>
                <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{t(`step${step}Body`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED CREATORS — horizontal rail */}
      {creators.length > 0 && (
        <section className="py-8">
          <div className="mb-4 flex items-baseline justify-between px-1">
            <h2 className="font-display text-xl font-bold sm:text-2xl">{t("featuredCreators")}</h2>
            <Link href="/creators" className="text-sm font-semibold text-[hsl(var(--primary-ink))] hover:underline">
              {t("viewAll")}
            </Link>
          </div>
          <div
            className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{
              maskImage: "linear-gradient(90deg, transparent, #000 3%, #000 92%, transparent)",
              WebkitMaskImage: "linear-gradient(90deg, transparent, #000 3%, #000 92%, transparent)",
            }}
          >
            {creators.map((c, i) => (
              <div key={c.username ?? i} className="w-[280px] shrink-0 snap-start">
                <CreatorCard creator={c} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TRUST strip */}
      <section className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 py-12 text-xs font-medium text-[hsl(var(--muted-foreground))]">
        {[t("trustSecure"), t("trustPayment"), t("trustVerified"), t("trustLangs")].map((item) => (
          <span key={item} className="inline-flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-[hsl(var(--primary))]" aria-hidden />
            {item}
          </span>
        ))}
      </section>
    </div>
  );
}
