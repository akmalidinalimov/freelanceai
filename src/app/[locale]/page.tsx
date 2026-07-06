import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listFeaturedCreators, countActiveCreators, listRecentActivity } from "@/server/services/browse";
import { listFeaturedGigs } from "@/server/services/gig";
import { specLabel, specSlug } from "@/lib/specializations";
import { HomeSearch } from "@/components/home-search";
import { FeaturedGigLoop } from "@/components/featured-gig-loop";
import { ActivityTicker } from "@/components/activity-ticker";
import { CreatorCard } from "@/components/creator-card";
import { PrismCategoryCard } from "@/components/prism-category-card";
import { LivingBackground, normalizeBg, BG_CONCEPTS } from "@/components/living-background";
import { cardClass } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/* Prism category tiles (founder-chosen): the zipper `word` is a brand graphic
   kept identical across locales; the localized name/desc live in aria + pill. */
const CATS = [
  { spec: "ai_video", word: "AI VIDEO", desc: "catVideo" },
  { spec: "ai_image", word: "AI RASM", desc: "catImage" },
  { spec: "ai_avatar", word: "AVATAR", desc: "catAvatar" },
  { spec: "product_photo", word: "FOTO", desc: "catPhoto" },
  { spec: "voiceover", word: "OVOZ", desc: "catVoice" },
  { spec: "branding", word: "BREND", desc: "catBranding" },
  { spec: "motion", word: "MOTION", desc: "catMotion" },
  { spec: "image_edit", word: "RETUSH", desc: "catEdit" },
] as const;

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ bg?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Temporary living-background lab: ?bg=1|2|3 picks a concept (default 1).
  const { bg } = await searchParams;
  const bgVariant = normalizeBg(bg);
  const t = await getTranslations("Home");
  const creators = await listFeaturedCreators(8).catch(() => []);
  const creatorCount = await countActiveCreators().catch(() => 0);
  const activity = await listRecentActivity().catch(() => []);
  // Featured-gig loop replaces the vanity stat counters — real work on landing.
  // Quality gate: only featured gigs that actually have a cover image.
  const featuredGigs = (await listFeaturedGigs(8).catch(() => []))
    .filter((g) => g.coverUrl)
    .map((g) => ({
      slug: g.slug,
      title: g.title,
      coverUrl: g.coverUrl,
      coverFocal: g.coverFocal ?? null,
      sellerName: g.seller.firstName ?? g.seller.name ?? g.seller.username ?? "",
      sellerAvatar: g.seller.image ?? g.seller.photoUrl ?? null,
      ratingAvg: g.seller.sellerProfile?.ratingAvg ?? 0,
      ratingCount: g.seller.sellerProfile?.ratingCount ?? 0,
    }));
  const tickerItems = activity.map((e) =>
    e.type === "delivered"
      ? t("tickerDelivered", { name: e.name, title: e.extra })
      : e.type === "review"
        ? t("tickerReview", { name: e.name, rating: e.extra })
        : t("tickerJoined", { name: e.name })
  );

  return (
    <>
      {/* Amber Classic now ships from the locale layout on every page; the lab
          variants (?bg=2|3|4) still render here for comparison only. */}
      {bgVariant !== "1" && <LivingBackground variant={bgVariant} />}
      <ActivityTicker items={tickerItems} />
      {/* dot texture now lives in the AmberClassic background layer */}
      <div className="mx-auto max-w-5xl px-4">
        {/* Hero — AI concierge search over the living background */}
        <section className="relative isolate -mx-4 px-4">
          {bg && (
            <span className="pointer-events-none absolute bottom-2 right-2 z-20 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))]/80 px-2.5 py-1 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] backdrop-blur">
              bg {bgVariant} · {BG_CONCEPTS[bgVariant].name}
            </span>
          )}
          <div className="relative z-10 flex flex-col items-center gap-4 py-12 text-center sm:py-20">
            <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))]/10 px-4 py-1.5 text-xs font-bold text-[hsl(var(--primary))]">
              ✦ {t("eyebrowAI")}
              {creatorCount > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
                  {t("creatorsCount", { count: creatorCount })}
                </>
              )}
            </span>
            <h1 className="font-display max-w-[16ch] text-3xl font-extrabold leading-[1.08] text-balance sm:text-5xl">
              {t("searchHeadline")}{" "}
              <span className="text-[hsl(var(--primary))]">{t("searchHeadline2")}</span>
            </h1>
            <p className="max-w-[42ch] text-base text-[hsl(var(--muted-foreground))] sm:text-lg">
              {t("searchSub")}
            </p>
            <HomeSearch />
          </div>
        </section>

        {/* Featured-gig loop — real work rotating (replaces vanity stat counters) */}
        <FeaturedGigLoop gigs={featuredGigs} />

        {/* Categories */}
        <section className="py-6">
          <div className="mb-4 flex items-baseline justify-between px-1">
            <h2 className="font-display text-xl font-bold sm:text-2xl">{t("categoriesTitle")}</h2>
            <Link href="/browse" className="text-sm font-semibold text-[hsl(var(--primary-ink))] hover:underline">
              {t("viewAll")}
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CATS.map((c, i) => (
              <li key={c.spec}>
                <PrismCategoryCard
                  href={`/browse/${specSlug(c.spec)}`}
                  word={c.word}
                  label={specLabel(c.spec, locale)}
                  sub={t(c.desc)}
                  index={i}
                />
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section className="py-8">
          <h2 className="font-display mb-4 text-xl font-bold sm:text-2xl">{t("howItWorksTitle")}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((step) => (
              <div key={step} className={cardClass(false, "flex items-start gap-3 p-4")}>
                <div className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent))] font-bold text-[hsl(var(--accent-foreground))]">
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

        {/* Featured creators — horizontal rail */}
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

        {/* Trust strip — one quiet row of small badges */}
        <section className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 py-10 text-xs font-medium text-[hsl(var(--muted-foreground))]">
          {[t("trustSecure"), t("trustPayment"), t("trustVerified"), t("trustLangs")].map((item) => (
            <span key={item} className="inline-flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-[hsl(var(--accent))]" aria-hidden />
              {item}
            </span>
          ))}
        </section>
      </div>
    </>
  );
}
