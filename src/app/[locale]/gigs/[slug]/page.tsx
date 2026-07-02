import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getGigBySlug, incrementGigViews, listRelatedGigs } from "@/server/services/gig";
import { VerifiedBadge } from "@/components/verified-badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const gig = await getGigBySlug(slug).catch(() => null);
  if (!gig) return {};
  const description = gig.description.slice(0, 160);
  return {
    title: gig.title,
    description,
    openGraph: {
      title: gig.title,
      description,
      images: gig.coverUrl ? [gig.coverUrl] : [],
    },
  };
}
import { getGigReviews } from "@/server/services/review";
import { getCurrentUser } from "@/lib/session";
import { isGigSaved } from "@/server/services/saved";
import { formatUzs } from "@/lib/utils";
import { OrderPanel } from "@/components/order-panel";
import { Stars } from "@/components/stars";
import { ContactSellerButton } from "@/components/contact-seller-button";
import { SaveButton } from "@/components/save-button";
import { ReviewReply } from "@/components/review-reply";
import { RecentlyViewedTracker } from "@/components/recently-viewed-tracker";
import { FeatureGigButton } from "@/components/feature-gig-button";

const TIER_ORDER = { BASIC: 0, STANDARD: 1, PREMIUM: 2 } as const;

export default async function GigDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Gig");
  const tr = await getTranslations("Review");
  const tp = await getTranslations("Profile");
  const tc = await getTranslations("Common");

  const gig = await getGigBySlug(slug);
  if (!gig) notFound();
  await incrementGigViews(gig.id);

  const me = await getCurrentUser();
  const viewer = !me ? "guest" : me.id === gig.sellerId ? "owner" : "buyer";
  const saved = me && viewer !== "owner" ? await isGigSaved(me.id, gig.id) : false;

  const seller = gig.seller.firstName ?? gig.seller.name ?? gig.seller.username ?? "";
  const packages = [...gig.packages].sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
  const tierLabel = { BASIC: t("basic"), STANDARD: t("standard"), PREMIUM: t("premium") } as const;
  const { reviews, avg, count, distribution } = await getGigReviews(gig.id);
  const related = await listRelatedGigs(gig.id, gig.categoryId);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: gig.title,
    description: gig.description.slice(0, 200),
    ...(gig.coverUrl ? { image: gig.coverUrl } : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "UZS",
      price: packages[0]?.priceUzs ?? 0,
      availability: "https://schema.org/InStock",
    },
    ...(count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: avg.toFixed(1), reviewCount: count } }
      : {}),
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_360px]">
      <script
        type="application/ld+json"
        // Structured data for search engines (Product + offers + rating).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <RecentlyViewedTracker gigId={gig.id} />
      <div>
        <div className="mb-5 flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))]/15 to-[hsl(var(--accent))]/15 text-5xl font-bold text-[hsl(var(--primary))]">
          {gig.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gig.coverUrl} alt={gig.title} className="h-full w-full object-cover" />
          ) : (
            gig.title.slice(0, 1).toUpperCase()
          )}
        </div>
        {gig.galleryUrls.length > 0 && (
          <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {gig.galleryUrls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="aspect-video overflow-hidden rounded-lg border border-[hsl(var(--border))]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {gig.featured && (
            <span className="rounded-full bg-[hsl(var(--primary))] px-2 py-0.5 text-xs font-bold text-[hsl(var(--primary-foreground))]">
              ★ {t("featured")}
            </span>
          )}
          {me?.role === "ADMIN" && <FeatureGigButton gigId={gig.id} featured={gig.featured} />}
        </div>
        <h1 className="mt-2 text-3xl font-bold">{gig.title}</h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          {t("byCreator")}{" "}
          {gig.seller.username ? (
            <Link
              href={`/creators/${gig.seller.username}`}
              className="font-medium text-[hsl(var(--primary))] hover:underline"
            >
              {seller}
            </Link>
          ) : (
            seller
          )}
          {gig.category ? ` · ${gig.category.nameUz}` : ""}
          {gig.seller.sellerProfile?.level && gig.seller.sellerProfile.level !== "NEW" && (
            <span className="ml-2 rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">
              {tp(`level.${gig.seller.sellerProfile.level}`)}
            </span>
          )}
          {gig.seller.kycStatus === "VERIFIED" && (
            <span className="ml-2 inline-block align-middle">
              <VerifiedBadge label={tp("verified")} />
            </span>
          )}
        </p>
        {count > 0 && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Stars value={avg} />
            <span className="font-medium">{avg.toFixed(1)}</span>
            <span className="text-[hsl(var(--muted-foreground))]">({count})</span>
          </div>
        )}
        {viewer === "owner" && (
          <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
            👁 {gig.views} {t("views")}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <ContactSellerButton gigId={gig.id} locale={locale} viewer={viewer} />
          <SaveButton gigId={gig.id} locale={locale} viewer={viewer} initialSaved={saved} />
        </div>
        <p className="mt-6 whitespace-pre-wrap leading-relaxed">{gig.description}</p>
        {gig.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {gig.tags.map((tag) => (
              <Link
                key={tag}
                href={`/gigs?q=${encodeURIComponent(tag)}`}
                className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/15 hover:text-[hsl(var(--primary))]"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}

        {packages.length > 1 && (
          <div className="mt-8 overflow-x-auto">
            <h2 className="mb-3 text-xl font-semibold">{t("comparePackages")}</h2>
            <table className="w-full min-w-[460px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="p-3" />
                  {packages.map((p) => (
                    <th key={p.tier} className="border-b border-[hsl(var(--border))] p-3 text-left font-semibold">
                      {tierLabel[p.tier]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 text-[hsl(var(--muted-foreground))]">{t("price")}</td>
                  {packages.map((p) => (
                    <td key={p.tier} className="p-3 font-semibold tabular-nums">
                      {formatUzs(p.priceUzs)} so&apos;m
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3 text-[hsl(var(--muted-foreground))]">{t("daysDelivery")}</td>
                  {packages.map((p) => (
                    <td key={p.tier} className="p-3 tabular-nums">
                      {p.deliveryDays}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3 text-[hsl(var(--muted-foreground))]">{t("revisionsLabel")}</td>
                  {packages.map((p) => (
                    <td key={p.tier} className="p-3 tabular-nums">
                      {p.revisions}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {Array.isArray(gig.faq) && gig.faq.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-xl font-semibold">{t("faq")}</h2>
            <div className="space-y-2">
              {(gig.faq as { q: string; a: string }[]).map((f, i) => (
                <details key={i} className="rounded-xl border border-[hsl(var(--border))] p-4">
                  <summary className="cursor-pointer text-sm font-medium">{f.q}</summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[hsl(var(--muted-foreground))]">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        )}

        {reviews.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-xl font-semibold">
              {tr("reviews")} ({count})
            </h2>
            <div className="mb-4 max-w-sm space-y-1">
              {distribution.map((d) => (
                <div key={d.star} className="flex items-center gap-2 text-xs">
                  <span className="w-6 tabular-nums">{d.star}★</span>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-[hsl(var(--muted))]">
                    <div
                      className="h-full bg-[hsl(var(--primary))]"
                      style={{ width: `${count ? (d.count / count) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-6 text-right tabular-nums text-[hsl(var(--muted-foreground))]">{d.count}</span>
                </div>
              ))}
            </div>
            <ul className="space-y-4">
              {reviews.map((rv) => (
                <li key={rv.id} className="rounded-xl border border-[hsl(var(--border))] p-4">
                  <div className="flex items-center gap-2">
                    <Stars value={rv.rating} />
                    <span className="text-sm font-medium">
                      {rv.author.firstName ?? rv.author.name ?? rv.author.username ?? tc("deletedUser")}
                    </span>
                  </div>
                  {rv.comment && <p className="mt-2 text-sm">{rv.comment}</p>}
                  {rv.sellerResponse && (
                    <div className="mt-2 rounded-lg bg-[hsl(var(--muted))]/40 p-2 text-sm">
                      <span className="font-medium">{tr("sellerReply")}: </span>
                      {rv.sellerResponse}
                    </div>
                  )}
                  {viewer === "owner" && !rv.sellerResponse && <ReviewReply reviewId={rv.id} />}
                </li>
              ))}
            </ul>
          </div>
        )}

        {related.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-xl font-semibold">{t("relatedTitle")}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {related.map((g) => (
                <Link
                  key={g.id}
                  href={`/gigs/${g.slug}`}
                  className="flex flex-col rounded-xl border border-[hsl(var(--border))] p-2 transition-colors hover:border-[hsl(var(--primary))]"
                >
                  <div className="mb-2 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[hsl(var(--primary))]/15 to-[hsl(var(--accent))]/15 text-lg font-bold text-[hsl(var(--primary))]">
                    {g.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.coverUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      g.title.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs font-medium">{g.title}</p>
                  <p className="mt-auto pt-1 text-xs font-semibold tabular-nums">
                    {t("from")} {formatUzs(g.packages[0]?.priceUzs ?? 0)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Packages + order */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <OrderPanel
          gigId={gig.id}
          locale={locale}
          viewer={viewer}
          packages={packages.map((p) => ({
            tier: p.tier,
            title: p.title,
            description: p.description,
            priceUzs: p.priceUzs,
            deliveryDays: p.deliveryDays,
            revisions: p.revisions,
          }))}
          extras={gig.extras.map((e) => ({
            id: e.id,
            title: e.title,
            priceUzs: e.priceUzs,
            deliveryDays: e.deliveryDays,
          }))}
          requirementPrompts={Array.isArray(gig.requirementPrompts) ? (gig.requirementPrompts as string[]) : []}
        />
      </aside>
    </div>
  );
}
