import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listFeaturedCreators, countActiveCreators, getHomeStats, listRecentActivity } from "@/server/services/browse";
import { specLabel, specSlug } from "@/lib/specializations";
import { HomeSearch } from "@/components/home-search";
import { ActivityTicker } from "@/components/activity-ticker";
import { CreatorCard } from "@/components/creator-card";
import {
  ArrowRight,
  Camera,
  Clapperboard,
  Film,
  Image as ImageIcon,
  Mic,
  PenTool,
  UserRound,
  Wand2,
} from "lucide-react";

export const dynamic = "force-dynamic";

const CATS = [
  { spec: "ai_video", Icon: Clapperboard, desc: "catVideo" },
  { spec: "ai_image", Icon: ImageIcon, desc: "catImage" },
  { spec: "ai_avatar", Icon: UserRound, desc: "catAvatar" },
  { spec: "product_photo", Icon: Camera, desc: "catPhoto" },
  { spec: "voiceover", Icon: Mic, desc: "catVoice" },
  { spec: "branding", Icon: PenTool, desc: "catBranding" },
  { spec: "motion", Icon: Film, desc: "catMotion" },
  { spec: "image_edit", Icon: Wand2, desc: "catEdit" },
] as const;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const creators = await listFeaturedCreators(8).catch(() => []);
  const creatorCount = await countActiveCreators().catch(() => 0);
  const stats = await getHomeStats().catch(() => ({ gigs: 0, creators: 0, orders: 0 }));
  const activity = await listRecentActivity().catch(() => []);
  // Show each stat only when it has a real, non-trivial number — never a sad "0" pre-launch.
  const statTiles = [
    { key: "statGigs", value: stats.gigs },
    { key: "statCreators", value: stats.creators },
    { key: "statOrders", value: stats.orders },
  ].filter((s) => s.value > 0);
  const tickerItems = activity.map((e) =>
    e.type === "delivered"
      ? t("tickerDelivered", { name: e.name, title: e.extra })
      : e.type === "review"
        ? t("tickerReview", { name: e.name, rating: e.extra })
        : t("tickerJoined", { name: e.name })
  );

  return (
    <>
      <ActivityTicker items={tickerItems} />
      <div
        className="mx-auto max-w-5xl px-4"
        style={{
          backgroundImage: "radial-gradient(hsl(var(--primary) / 0.06) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        {/* Hero — AI concierge search */}
        <section className="flex flex-col items-center gap-4 py-12 text-center sm:py-20">
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
        </section>

        {/* Platform stats — real counts, each shown only when non-zero */}
        {statTiles.length > 0 && (
          <section className="grid grid-cols-3 gap-3 pb-6">
            {statTiles.map((s) => (
              <div
                key={s.key}
                className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-4 text-center"
              >
                <p className="font-display text-2xl font-extrabold tabular-nums sm:text-3xl">
                  {s.value.toLocaleString()}
                </p>
                <p className="mt-0.5 text-xs font-medium text-[hsl(var(--muted-foreground))] sm:text-sm">
                  {t(s.key)}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* Categories */}
        <section className="py-6">
          <div className="mb-4 flex items-baseline justify-between px-1">
            <h2 className="font-display text-xl font-bold sm:text-2xl">{t("categoriesTitle")}</h2>
            <Link href="/browse" className="text-sm font-semibold text-[hsl(var(--primary))] hover:underline">
              {t("viewAll")}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CATS.map((c) => (
              <Link
                key={c.spec}
                href={`/browse/${specSlug(c.spec)}`}
                className="group relative overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition-all hover:-translate-y-1 hover:border-[hsl(var(--primary))]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                  <c.Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <ArrowRight className="absolute right-4 top-4 h-4 w-4 text-[hsl(var(--muted-foreground))] transition-transform group-hover:translate-x-1 group-hover:text-[hsl(var(--primary))]" />
                <h3 className="mt-3 text-sm font-bold">{specLabel(c.spec, locale)}</h3>
                <p className="mt-0.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  {t(c.desc)}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="py-8">
          <h2 className="font-display mb-4 text-xl font-bold sm:text-2xl">{t("howItWorksTitle")}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className="flex items-start gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"
              >
                <div className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--foreground))] font-bold text-[hsl(var(--background))]">
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
              <Link href="/creators" className="text-sm font-semibold text-[hsl(var(--primary))] hover:underline">
                {t("viewAll")}
              </Link>
            </div>
            <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {creators.map((c, i) => (
                <div key={c.username ?? i} className="w-[280px] shrink-0 [scroll-snap-align:start]">
                  <CreatorCard creator={c} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Trust strip */}
        <section className="flex flex-wrap justify-center gap-2 py-10">
          {[t("trustSecure"), t("trustPayment"), t("trustVerified"), t("trustLangs")].map((item) => (
            <span
              key={item}
              className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))]"
            >
              {item}
            </span>
          ))}
        </section>
      </div>
    </>
  );
}
