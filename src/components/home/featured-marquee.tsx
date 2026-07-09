"use client";

import { useEffect, useRef } from "react";
import { Link } from "@/i18n/navigation";
import { coverVariant } from "@/lib/cover-variant";

export interface MarqueeGig {
  slug: string;
  title: string;
  coverUrl: string | null;
  coverPosterUrl: string | null;
  sellerName: string;
  sellerAvatar: string | null;
  ratingAvg: number;
  ratingCount: number;
}

const FALLBACK = "/prism/pattern-sweep-dark-wide-v1.webp";

/**
 * Featured-gig marquee (founder-approved, 2026-07-09): a continuously scrolling,
 * clickable strip of real featured gigs. Cards rotate slightly by their horizontal
 * position (carousel feel) and the strip pauses the moment a finger lands on it, so
 * a moving card is easy to tap. Reduced-motion → a plain swipe rail (see globals.css).
 */
export function FeaturedMarquee({ gigs }: { gigs: MarqueeGig[] }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // pause on touch, resume shortly after the finger lifts
    let resumeTimer: ReturnType<typeof setTimeout>;
    const onTouchStart = () => {
      root.classList.add("paused");
      clearTimeout(resumeTimer);
    };
    const onTouchEnd = () => {
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => root.classList.remove("paused"), 2200);
    };
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchend", onTouchEnd, { passive: true });

    // rotate cards by horizontal position for a subtle carousel feel
    let raf = 0;
    const cards = Array.from(root.querySelectorAll<HTMLElement>(".home-mcard"));
    const spin = () => {
      const vw = window.innerWidth;
      for (const el of cards) {
        const r = el.getBoundingClientRect();
        if (r.right < 0 || r.left > vw) continue;
        const cx = r.left + r.width / 2;
        const d = (cx - vw / 2) / vw;
        const ry = Math.max(-13, Math.min(13, -d * 17));
        el.style.transform = `perspective(1200px) rotateY(${ry.toFixed(2)}deg)`;
      }
      raf = requestAnimationFrame(spin);
    };
    if (!reduce && cards.length) raf = requestAnimationFrame(spin);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(resumeTimer);
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchend", onTouchEnd);
    };
  }, [gigs]);

  if (gigs.length === 0) return null;

  // duplicate the set so the scroll loops seamlessly
  const loop = [...gigs, ...gigs];

  return (
    <div className="home-marquee" ref={rootRef}>
      <div className="home-marquee-track">
        {loop.map((g, i) => {
          const v = coverVariant(g.slug);
          const dup = i >= gigs.length;
          return (
            <Link
              key={`${g.slug}-${i}`}
              href={`/gigs/${g.slug}`}
              className="home-mcard flex flex-col overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-soft)]"
              aria-hidden={dup || undefined}
              tabIndex={dup ? -1 : undefined}
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-[hsl(var(--surface-2))]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.coverPosterUrl ?? g.coverUrl ?? FALLBACK}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                  style={{ objectPosition: v.pos, transform: v.flip ? "scaleX(-1)" : undefined }}
                />
                {g.ratingCount > 0 && (
                  <span className="absolute bottom-2.5 right-2.5 rounded-full bg-[hsl(var(--foreground))]/72 px-2.5 py-1 text-[0.72rem] font-bold text-white backdrop-blur-sm">
                    ★ {g.ratingAvg.toFixed(1)} · {g.ratingCount}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="line-clamp-2 font-bold leading-snug tracking-[-0.01em]">{g.title}</h3>
                <div className="mt-auto flex items-center gap-2 border-t border-[hsl(var(--border))] pt-3 text-sm font-semibold text-[hsl(var(--muted-foreground))]">
                  {g.sellerAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.sellerAvatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[hsl(var(--primary))] text-[0.65rem] font-bold text-white">
                      {g.sellerName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="truncate text-[hsl(var(--foreground))]">{g.sellerName}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
