import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getGigBySlug } from "@/server/services/gig";
import { getGigReviews } from "@/server/services/review";
import { getCurrentUser } from "@/lib/session";
import { formatUzs } from "@/lib/utils";
import { OrderPanel } from "@/components/order-panel";
import { Stars } from "@/components/stars";

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

  const gig = await getGigBySlug(slug);
  if (!gig) notFound();

  const me = await getCurrentUser();
  const viewer = !me ? "guest" : me.id === gig.sellerId ? "owner" : "buyer";

  const seller = gig.seller.firstName ?? gig.seller.name ?? gig.seller.username ?? "";
  const packages = [...gig.packages].sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
  const { reviews, avg, count } = await getGigReviews(gig.id);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="mb-5 flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))]/15 to-[hsl(var(--accent))]/15 text-5xl font-bold text-[hsl(var(--primary))]">
          {gig.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gig.coverUrl} alt={gig.title} className="h-full w-full object-cover" />
          ) : (
            gig.title.slice(0, 1).toUpperCase()
          )}
        </div>
        <h1 className="text-3xl font-bold">{gig.title}</h1>
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
        </p>
        {count > 0 && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Stars value={avg} />
            <span className="font-medium">{avg.toFixed(1)}</span>
            <span className="text-[hsl(var(--muted-foreground))]">({count})</span>
          </div>
        )}
        <p className="mt-6 whitespace-pre-wrap leading-relaxed">{gig.description}</p>
        {gig.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {gig.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-xs text-[hsl(var(--muted-foreground))]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {reviews.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-xl font-semibold">
              {tr("reviews")} ({count})
            </h2>
            <ul className="space-y-4">
              {reviews.map((rv) => (
                <li key={rv.id} className="rounded-xl border border-[hsl(var(--border))] p-4">
                  <div className="flex items-center gap-2">
                    <Stars value={rv.rating} />
                    <span className="text-sm font-medium">
                      {rv.author.firstName ?? rv.author.name ?? rv.author.username ?? ""}
                    </span>
                  </div>
                  {rv.comment && <p className="mt-2 text-sm">{rv.comment}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Packages + order */}
      <aside>
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
        />
      </aside>
    </div>
  );
}
