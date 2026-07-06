import { getTranslations } from "next-intl/server";
import { Lock, Star, Clock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatUzs } from "@/lib/utils";
import { coverVariant } from "@/lib/cover-variant";
import { approxPrice } from "@/lib/currency";
import { SaveHeart } from "@/components/save-heart";
import { listPublicGigs } from "@/server/services/gig";

type GigItem = Awaited<ReturnType<typeof listPublicGigs>>[number];

/** A gig card styled like a macOS browser window (traffic-light chrome + address bar). */
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
  const seller = gig.seller.firstName ?? gig.seller.name ?? gig.seller.username ?? "";
  const handle = gig.seller.username ?? gig.slug;
  const avatar = gig.seller.photoUrl ?? gig.seller.image;
  const rating = gig.seller.sellerProfile?.ratingAvg ?? 0;
  const ratingCount = gig.seller.sellerProfile?.ratingCount ?? 0;

  return (
    <Link
      href={`/gigs/${gig.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-soft)] transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[hsl(var(--primary))]/30 hover:shadow-[var(--shadow-hover)]"
    >
      {/* Browser chrome — warm-white bar, softened traffic lights */}
      <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-2">
        <span className="flex shrink-0 gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/85" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/85" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/85" />
        </span>
        <span className="ml-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-[11px] text-[hsl(var(--muted-foreground))]">
          <Lock className="h-3 w-3 shrink-0 text-[#28c840]" strokeWidth={2.25} />
          <span className="truncate">
            gigora.ai/<span className="font-medium text-[hsl(var(--foreground))]/70">{handle}</span>
          </span>
        </span>
      </div>

      {/* Viewport (the "page") */}
      <div className="relative flex aspect-video items-center justify-center overflow-hidden">
        <SaveHeart gigId={gig.id} locale={locale} initialSaved={saved} isGuest={isGuest} />
        {gig.featured && (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-[hsl(var(--primary))] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--primary-foreground))] shadow-sm">
            ★ {tg("featured")}
          </span>
        )}
        {gig.coverUrl ? (
          (() => {
            // Covers are per-category, so same-category gigs share one photo.
            // Crop + mirror per gig id so a grid / related rail isn't 4 clones.
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
                  // Creator-chosen focal point wins; else the per-gig de-dupe crop/flip.
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
                  src="/prism/pattern-sweep-v2.webp"
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
                  className="font-display absolute select-none text-4xl font-black tracking-tight text-white/90 transition-transform duration-500 group-hover:scale-110"
                  style={{ textShadow: "0 2px 16px hsl(20 20% 10% / .35)" }}
                >
                  {gig.title.slice(0, 1).toUpperCase()}
                </span>
              </>
            );
          })()
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/15 text-[10px] font-bold text-[hsl(var(--primary-ink))]">
              {seller.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="truncate text-sm text-[hsl(var(--muted-foreground))]">{seller}</span>
          {ratingCount > 0 && (
            <span className="ml-auto flex shrink-0 items-center gap-1 text-sm">
              <Star className="h-3.5 w-3.5 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
              <span className="font-semibold tabular-nums">{rating.toFixed(1)}</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">({ratingCount})</span>
            </span>
          )}
        </div>

        <p className="line-clamp-2 min-h-[2.6em] font-medium leading-snug">{gig.title}</p>

        <div className="mt-auto flex items-end justify-between border-t border-[hsl(var(--border))] pt-3">
          {pkg?.deliveryDays ? (
            <span className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
              <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
              {pkg.deliveryDays} {tg("daysDelivery")}
            </span>
          ) : (
            <span />
          )}
          <span className="text-right">
            {/* "starting-at" framing: sets an honest expectation (entry point, not a
                ceiling) beside the price filter, in a calm weight so it doesn't shout. */}
            <span className="block text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              {tg("startingFrom")}
            </span>
            <span className="block text-sm font-semibold tabular-nums">
              {formatUzs(from)} so&apos;m
            </span>
            <span className="block text-[11px] text-[hsl(var(--muted-foreground))]">
              {approxPrice(from)}
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
