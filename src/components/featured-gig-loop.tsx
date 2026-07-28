"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Star, ArrowRight } from "lucide-react";

export interface FeaturedGigItem {
  slug: string;
  title: string;
  coverUrl: string | null;
  coverFocal: string | null;
  coverType: string | null;
  coverPosterUrl: string | null;
  sellerName: string;
  sellerAvatar: string | null;
  ratingAvg: number;
  ratingCount: number;
}

/**
 * Rotating featured-gig spotlight — replaces the vanity stat counters on the home hero.
 * A uniform 16:9 banner cross-fades through real featured gigs. Video covers autoplay
 * (muted loop) only while their slide is active; image covers use the stored focal point.
 * Auto-advance pauses under reduced-motion.
 */
export function FeaturedGigLoop({ gigs }: { gigs: FeaturedGigItem[] }) {
  const t = useTranslations("Home");
  const [active, setActive] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    if (gigs.length <= 1) return;
    const id = setInterval(() => setActive((a) => (a + 1) % gigs.length), 5000);
    return () => clearInterval(id);
  }, [gigs.length]);

  // Only the active slide's video plays — keeps the hero light on mobile data.
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === active) v.play().catch(() => {});
      else {
        v.pause();
        v.currentTime = 0;
      }
    });
  }, [active]);

  if (gigs.length === 0) return null;

  return (
    <section className="pb-8" aria-roledescription="carousel">
      <div className="mb-3 flex items-center gap-2 px-1 text-sm font-bold text-[hsl(var(--muted-foreground))]">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[hsl(var(--primary))]" />
        {t("featuredTitle")}
      </div>

      <div className="relative mx-auto aspect-video w-full max-w-[640px] overflow-hidden rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--muted))] shadow-[var(--shadow-hover)]">
        {gigs.map((g, i) => {
          const isVideo = g.coverType === "video" && !!g.coverUrl;
          const src = g.coverUrl ?? "/prism/pattern-sweep-dark-wide-v1.webp";
          return (
            <Link
              key={g.slug}
              href={`/gigs/${g.slug}`}
              aria-hidden={i !== active}
              tabIndex={i === active ? 0 : -1}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                i === active ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              {isVideo ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  ref={(el) => {
                    videoRefs.current[i] = el;
                  }}
                  src={g.coverUrl!}
                  poster={g.coverPosterUrl ?? undefined}
                  muted
                  loop
                  playsInline
                  preload={i === 0 ? "auto" : "none"}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: g.coverFocal ?? "center" }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={g.title}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: g.coverFocal ?? "center" }}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                />
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 pt-10">
                {g.sellerAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.sellerAvatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white/25" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white ring-2 ring-white/25">
                    {g.sellerName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-white">{g.title}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-white/80">
                    <span className="truncate">{g.sellerName}</span>
                    {g.ratingCount > 0 && (
                      <span className="flex shrink-0 items-center gap-0.5 font-semibold text-[#ffd36b]">
                        <Star className="h-3.5 w-3.5 fill-[#ffd36b] text-[#ffd36b]" />
                        {g.ratingAvg.toFixed(1)}
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
                  {t("featuredView")}
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {gigs.length > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {gigs.map((g, i) => (
            <button
              key={g.slug}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`${i + 1}`}
              aria-current={i === active}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-5 bg-[hsl(var(--primary))]" : "w-1.5 bg-[hsl(var(--border))]"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
