"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { coverVariant } from "@/lib/cover-variant";
import { formatUzs } from "@/lib/utils";

export interface MarqueeGig {
  slug: string;
  title: string;
  coverUrl: string | null;
  coverPosterUrl: string | null;
  username: string | null;
  sellerName: string;
  sellerAvatar: string | null;
  verified: boolean;
  featured: boolean;
  priceUzs: number;
  orders: number;
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
  const t = useTranslations("Gig");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // The rail is a native horizontal scroller, so the browser handles finger-swiping
    // (with momentum) for free. We only drive a calm idle auto-advance by nudging
    // scrollLeft each frame; it pauses the moment the user touches/drags/hovers and
    // resumes shortly after they let go — so an accidental touch no longer "kills" it.
    let paused = reduce; // reduced-motion: no auto-advance (manual swipe still works)
    let idleTimer: ReturnType<typeof setTimeout>;
    let raf = 0;
    const SPEED = 0.4; // px/frame ≈ a gentle drift

    const step = () => {
      if (!paused) {
        root.scrollLeft += SPEED;
        // content is duplicated ([...gigs, ...gigs]); loop by one copy width, seamlessly
        const half = root.scrollWidth / 2;
        if (half > 0 && root.scrollLeft >= half) root.scrollLeft -= half;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const pause = () => {
      paused = true;
      clearTimeout(idleTimer);
    };
    const resumeSoon = () => {
      if (reduce) return;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        paused = false;
      }, 1800);
    };
    const onWheel = () => {
      pause();
      resumeSoon();
    };

    root.addEventListener("pointerdown", pause);
    root.addEventListener("pointerup", resumeSoon);
    root.addEventListener("pointercancel", resumeSoon);
    root.addEventListener("touchstart", pause, { passive: true });
    root.addEventListener("touchend", resumeSoon, { passive: true });
    root.addEventListener("wheel", onWheel, { passive: true });
    root.addEventListener("mouseenter", pause);
    root.addEventListener("mouseleave", resumeSoon);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(idleTimer);
      root.removeEventListener("pointerdown", pause);
      root.removeEventListener("pointerup", resumeSoon);
      root.removeEventListener("pointercancel", resumeSoon);
      root.removeEventListener("touchstart", pause);
      root.removeEventListener("touchend", resumeSoon);
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("mouseenter", pause);
      root.removeEventListener("mouseleave", resumeSoon);
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
                {g.featured && (
                  <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[0.72rem] font-bold text-[hsl(var(--primary-ink))] shadow-[0_2px_8px_rgba(0,0,0,0.14)] backdrop-blur-sm">
                    ⚡ {t("topCreator")}
                  </span>
                )}
                {g.orders > 0 && (
                  <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/70 px-2.5 py-1 text-[0.72rem] font-bold text-white backdrop-blur-sm">
                    {t("ordersCount", { count: g.orders })}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2.5 p-4">
                <h3 className="line-clamp-2 font-display font-bold leading-snug tracking-[-0.01em]">{g.title}</h3>
                <div className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--muted-foreground))]">
                  {g.sellerAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.sellerAvatar} alt="" className="h-7 w-7 shrink-0 rounded-[9px] object-cover" />
                  ) : (
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-[hsl(var(--primary))]/15 text-[0.7rem] font-bold text-[hsl(var(--primary-ink))]">
                      {(g.username ?? g.sellerName).slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="truncate text-[hsl(var(--foreground))]">
                    {g.username ? `@${g.username}` : g.sellerName}
                  </span>
                  {g.verified && (
                    <span className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full bg-[hsl(var(--primary))] text-[0.6rem] text-white">
                      ✓
                    </span>
                  )}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-[hsl(var(--border))] pt-3">
                  {g.ratingCount > 0 ? (
                    <span className="flex items-center gap-1 text-sm font-bold text-[hsl(var(--foreground))]">
                      <span className="text-[hsl(var(--star))]">★</span>
                      {g.ratingAvg.toFixed(1)}
                      <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">({g.ratingCount})</span>
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{t("newSeller")}</span>
                  )}
                  <span className="font-display rounded-[11px] border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/10 px-2.5 py-1 text-[0.95rem] font-bold tabular-nums text-[hsl(var(--primary-ink))]">
                    {formatUzs(g.priceUzs)} <span className="text-[0.72em] font-semibold opacity-80">{t("sum")}</span>
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
