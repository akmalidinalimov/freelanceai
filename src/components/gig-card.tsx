import { getTranslations } from "next-intl/server";
import { Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatUzs } from "@/lib/utils";
import { coverVariant } from "@/lib/cover-variant";
import { approxPrice } from "@/lib/currency";
import { SaveHeart } from "@/components/save-heart";
import { GigCoverVideo } from "@/components/gig-cover-video";
import { listPublicGigs } from "@/server/services/gig";

type GigItem = Awaited<ReturnType<typeof listPublicGigs>>[number];

/**
 * Gig card — the "clay meets Apple" c2f featured-card look: a clean white card
 * that lifts on hover, a 16:9 cover with a status badge + order-count chip, then
 * the title, the creator handle with the orange verified tick, and an orange
 * star rating beside an orange price pill.
 */
export async function GigCard({
  gig,
  locale,
  saved = false,
  isGuest = true,
}: {
  gig: GigItem;
  locale: string;
  saved?: boolean;
  isGuest?: boolean;
}) {
  const tg = await getTranslations("Gig");
  const pkg = gig.packages[0];
  const from = pkg?.priceUzs ?? 0;
  const handle = gig.seller.username ?? gig.slug;
  const avatar = gig.seller.photoUrl ?? gig.seller.image;
  const rating = gig.seller.sellerProfile?.ratingAvg ?? 0;
  const ratingCount = gig.seller.sellerProfile?.ratingCount ?? 0;
  const orders = gig._count?.orders ?? 0;

  return (
    <Link
      href={`/gigs/${gig.slug}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-soft)] transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-1 hover:border-[hsl(var(--border))] hover:shadow-[var(--shadow-hover)]"
    >
      {/* Cover — uniform 16:9 banner (image or video) */}
      <div className="relative aspect-video overflow-hidden bg-[hsl(var(--surface-2))]">
        <SaveHeart gigId={gig.id} locale={locale} initialSaved={saved} isGuest={isGuest} />
        {gig.featured && (
          <span className="absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[0.72rem] font-bold text-[hsl(var(--primary-ink))] shadow-[0_2px_8px_rgba(0,0,0,0.14)] backdrop-blur-sm">
            ★ {tg("featured")}
          </span>
        )}
        {orders > 0 && (
          <span className="absolute bottom-2.5 right-2.5 z-10 rounded-full bg-black/70 px-2.5 py-1 text-[0.72rem] font-bold text-white backdrop-blur-sm">
            {tg("ordersCount", { count: orders })}
          </span>
        )}
        {gig.coverUrl && gig.coverType === "video" ? (
          <GigCoverVideo url={gig.coverUrl} poster={gig.coverPosterUrl} focal={gig.coverFocal} />
        ) : gig.coverUrl ? (
          (() => {
            const v = coverVariant(gig.id);
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={gig.coverUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                style={{
                  objectPosition: gig.coverFocal ?? v.pos,
                  transform: gig.coverFocal ? undefined : v.flip ? "scaleX(-1)" : undefined,
                }}
              />
            );
          })()
        ) : (
          (() => {
            const v = coverVariant(gig.id);
            return (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/prism/pattern-sweep-dark-wide-v1.webp"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  style={{
                    objectPosition: v.pos,
                    transform: v.flip ? "scaleX(-1)" : undefined,
                    filter: `brightness(1.02) contrast(1.06) saturate(1.06)${v.hue ? ` hue-rotate(${v.hue}deg)` : ""}`,
                  }}
                />
                <span
                  className="font-display absolute inset-0 grid select-none place-items-center text-4xl font-black tracking-tight text-white/90 transition-transform duration-500 group-hover:scale-110"
                  style={{ textShadow: "0 2px 16px hsl(20 20% 10% / .35)" }}
                >
                  {gig.title.slice(0, 1).toUpperCase()}
                </span>
              </>
            );
          })()
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <h3 className="line-clamp-2 min-h-[2.6em] font-display text-[1.04rem] font-bold leading-snug tracking-[-0.01em]">
          {gig.title}
        </h3>

        {/* Creator handle + verified tick */}
        <div className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--muted-foreground))]">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-7 w-7 shrink-0 rounded-[9px] object-cover" />
          ) : (
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-[hsl(var(--primary))]/15 text-[0.7rem] font-bold text-[hsl(var(--primary-ink))]">
              {handle.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="truncate">@{handle}</span>
          {gig.seller.sellerProfile && ratingCount >= 0 && gig.seller.username && (
            <span className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full bg-[hsl(var(--primary))] text-[0.6rem] text-white">
              ✓
            </span>
          )}
        </div>

        {/* Rating + price */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[hsl(var(--border))] pt-3">
          {ratingCount > 0 ? (
            <span className="flex items-center gap-1 text-sm font-bold text-[hsl(var(--foreground))]">
              <Star className="h-4 w-4 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
              {rating.toFixed(1)}
              <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">({ratingCount})</span>
            </span>
          ) : (
            <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{tg("newSeller")}</span>
          )}
          <span
            className="font-display rounded-[11px] border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/10 px-2.5 py-1 text-[0.95rem] font-bold tabular-nums text-[hsl(var(--primary-ink))]"
            title={approxPrice(from)}
          >
            {formatUzs(from)} <span className="text-[0.72em] font-semibold opacity-80">{tg("sum")}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
