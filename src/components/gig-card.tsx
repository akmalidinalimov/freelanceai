import { getTranslations } from "next-intl/server";
import { Lock, Star, Clock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatUzs } from "@/lib/utils";
import { approxPrice } from "@/lib/currency";
import { SaveHeart } from "@/components/save-heart";
import { listPublicGigs } from "@/server/services/gig";

type GigItem = Awaited<ReturnType<typeof listPublicGigs>>[number];

/** Deterministic soft gradient for gigs without a cover image. */
const PALETTES = [
  ["#14b8a6", "#0f766e"], // teal
  ["#8b5cf6", "#6d28d9"], // violet
  ["#f59e0b", "#d97706"], // amber
  ["#ec4899", "#be185d"], // pink
  ["#3b82f6", "#1d4ed8"], // blue
  ["#06b6d4", "#0e7490"], // cyan
] as const;

function coverGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const [a, b] = PALETTES[h % PALETTES.length];
  return `linear-gradient(135deg, ${a}22, ${b}33), radial-gradient(80% 90% at 20% 10%, ${a}2e, transparent 60%)`;
}

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
      className="group relative flex flex-col overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[hsl(var(--primary))]/60 hover:shadow-[0_20px_40px_-16px_hsl(var(--primary)/0.25)]"
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/60 px-3 py-2">
        <span className="flex shrink-0 gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="ml-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-[11px] text-[hsl(var(--muted-foreground))]">
          <Lock className="h-3 w-3 shrink-0 text-[#28c840]" strokeWidth={2.25} />
          <span className="truncate">
            gigora.ai/<span className="font-medium text-[hsl(var(--foreground))]/70">{handle}</span>
          </span>
        </span>
      </div>

      {/* Viewport (the "page") */}
      <div
        className="relative flex aspect-video items-center justify-center overflow-hidden"
        style={gig.coverUrl ? undefined : { backgroundImage: coverGradient(gig.id) }}
      >
        <SaveHeart gigId={gig.id} locale={locale} initialSaved={saved} isGuest={isGuest} />
        {gig.featured && (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-[hsl(var(--primary))] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--primary-foreground))] shadow-sm">
            ★ {tg("featured")}
          </span>
        )}
        {gig.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gig.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="select-none text-4xl font-black tracking-tight text-[hsl(var(--primary-ink))]/30 transition-transform duration-500 group-hover:scale-110">
            {gig.title.slice(0, 1).toUpperCase()}
          </span>
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
              <Star className="h-3.5 w-3.5 fill-[#f5a623] text-[#f5a623]" />
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
            <span className="block text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              {tg("from")}
            </span>
            <span className="block text-sm font-bold tabular-nums">
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
