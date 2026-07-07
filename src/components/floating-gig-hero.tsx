"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Star, ArrowRight, Play } from "lucide-react";
import { formatUzs } from "@/lib/utils";
import type { FeaturedGigItem } from "@/components/featured-gig-loop";

export interface HeroGigItem extends FeaturedGigItem {
  priceUzs: number | null;
}

/**
 * FloatingGigHero — the redesigned "gig on the homepage" (founder direction 2026-07-08,
 * Laocoön reference): the featured gig is a large card that FLOATS over a breathing teal
 * glow and auto-rotates through real featured gigs, with an editorial caption
 * (title · creator · ★rating · starting-at price). Video covers autoplay while shown.
 * A quick fade-out → swap → fade-in keeps the height stable; motion pauses under
 * prefers-reduced-motion.
 */
export function FloatingGigHero({ gigs }: { gigs: HeroGigItem[] }) {
  const t = useTranslations("Home");
  const tg = useTranslations("Gig");
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    if (gigs.length <= 1) return;
    const id = setInterval(() => {
      setShown(false);
      setTimeout(() => {
        setActive((a) => (a + 1) % gigs.length);
        setShown(true);
      }, 340);
    }, 4200);
    return () => clearInterval(id);
  }, [gigs.length]);

  useEffect(() => {
    if (shown) videoRef.current?.play?.().catch(() => {});
  }, [active, shown]);

  if (gigs.length === 0) return null;
  const g = gigs[active];
  const isVideo = g.coverType === "video" && !!g.coverUrl;
  const src = g.coverUrl ?? "/prism/pattern-sweep-dark-wide-v1.webp";

  return (
    <div className="relative flex items-center justify-center py-6" aria-roledescription="carousel">
      {/* breathing teal glow behind the card */}
      <div
        aria-hidden
        className="anim-glow pointer-events-none absolute h-[78%] w-[82%] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(173 70% 45% / .34), hsl(190 82% 60% / .12) 45%, transparent 70%)" }}
      />
      <div className="anim-bob relative w-full max-w-[420px]">
        <Link
          href={`/gigs/${g.slug}`}
          className={`group block overflow-hidden rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-overlay)] transition-opacity duration-300 ${
            shown ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="relative aspect-video overflow-hidden">
            {isVideo ? (
              <video
                ref={videoRef}
                src={g.coverUrl!}
                poster={g.coverPosterUrl ?? undefined}
                muted
                loop
                playsInline
                preload="auto"
                className="h-full w-full object-cover"
                style={{ objectPosition: g.coverFocal ?? "center" }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={g.title}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                style={{ objectPosition: g.coverFocal ?? "center" }}
                loading="eager"
                decoding="async"
              />
            )}
            {isVideo && (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                <Play className="h-3 w-3 fill-white" strokeWidth={0} /> {tg("featured")}
              </span>
            )}
          </div>

          {/* editorial caption plate */}
          <div className="p-4">
            <p className="line-clamp-2 min-h-[2.6em] font-semibold leading-snug">{g.title}</p>
            <div className="mt-2 flex items-center gap-2">
              {g.sellerAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.sellerAvatar} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/15 text-[10px] font-bold text-[hsl(var(--primary-ink))]">
                  {g.sellerName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="truncate text-sm text-[hsl(var(--muted-foreground))]">{g.sellerName}</span>
              {g.ratingCount > 0 && (
                <span className="ml-auto flex shrink-0 items-center gap-1 text-sm">
                  <Star className="h-3.5 w-3.5 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                  <span className="font-semibold tabular-nums">{g.ratingAvg.toFixed(1)}</span>
                </span>
              )}
            </div>
            <div className="mt-3 flex items-end justify-between border-t border-[hsl(var(--border))] pt-3">
              {g.priceUzs != null ? (
                <span>
                  <span className="block text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    {tg("startingFrom")}
                  </span>
                  <span className="block text-sm font-bold tabular-nums">{formatUzs(g.priceUzs)} so&apos;m</span>
                </span>
              ) : (
                <span />
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--primary))]/12 px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary-ink))] transition-colors group-hover:bg-[hsl(var(--primary))]/20">
                {t("featuredView")}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
              </span>
            </div>
          </div>
        </Link>

        {gigs.length > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            {gigs.map((gg, i) => (
              <button
                key={gg.slug}
                type="button"
                onClick={() => {
                  setShown(false);
                  setTimeout(() => {
                    setActive(i);
                    setShown(true);
                  }, 200);
                }}
                aria-label={`${i + 1}`}
                aria-current={i === active}
                className={`h-1.5 rounded-full transition-all ${
                  i === active ? "w-6 bg-[hsl(var(--primary))]" : "w-1.5 bg-[hsl(var(--border))]"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
