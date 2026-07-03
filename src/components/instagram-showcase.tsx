"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Instagram, Play, X } from "lucide-react";

type IgItem = {
  id: string;
  mediaUrl: string;
  mediaType: string;
  permalink: string | null;
  caption: string | null;
};

/**
 * A self-flowing film strip of a creator's synced Instagram content. Pure-CSS
 * transform marquee over a duplicated list (seamless wrap); pauses on hover;
 * on touch it's a normal swipeable row and the flow resumes ~3s after the finger
 * lifts. Reduced-motion → a static scrollable row. Renders nothing when empty.
 * Never calls instagram.com — mediaUrl is our own re-hosted copy.
 */
export function InstagramShowcase({ items, handle }: { items: IgItem[]; handle: string | null }) {
  const ti = useTranslations("Instagram");
  const [lightbox, setLightbox] = useState<IgItem | null>(null);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setAnimate(false);
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLightbox(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  if (items.length === 0) return null;

  // 1–2 items would show gaps in a loop → static centered row. Else marquee.
  const marquee = animate && items.length >= 3;
  // Repeat the base list until it comfortably fills the viewport, then clone it once.
  const rep = Math.max(1, Math.ceil(8 / items.length));
  const base = Array.from({ length: rep }, () => items).flat();

  const pauseThenResume = () => {
    setPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), 3000);
  };

  const igUrl = handle ? `https://www.instagram.com/${handle}` : undefined;

  const Tile = ({ p, eager, clone }: { p: IgItem; eager: boolean; clone: boolean }) => {
    const isVideo = p.mediaType === "video";
    const label = ti("postBy", { handle: handle ?? "" });
    const inner = (
      <div className="relative aspect-[4/5] w-40 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] sm:w-44">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.mediaUrl}
          alt={p.caption ?? ""}
          width={176}
          height={220}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover"
        />
        <span className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
          <Instagram className="h-3.5 w-3.5" aria-hidden />
        </span>
        {isVideo && (
          <span className="absolute inset-0 grid place-items-center" aria-hidden>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-black/50 pl-0.5 text-white backdrop-blur-sm">
              <Play className="h-5 w-5 fill-white" />
            </span>
          </span>
        )}
      </div>
    );
    const shared = {
      "aria-label": label,
      ...(clone ? { tabIndex: -1, "aria-hidden": true } : {}),
    } as const;
    return p.permalink ? (
      <a href={p.permalink} target="_blank" rel="noopener noreferrer" {...shared}>
        {inner}
      </a>
    ) : (
      <button type="button" onClick={() => setLightbox(p)} {...shared}>
        {inner}
      </button>
    );
  };

  const renderList = (clone: boolean) =>
    base.map((p, i) => (
      <li key={(clone ? "c" : "") + p.id + i}>
        <Tile p={p} eager={!clone && i < 3} clone={clone} />
      </li>
    ));

  return (
    <section aria-label={ti("showcaseLabel")} className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <Instagram className="h-4 w-4 text-[hsl(var(--accent))]" aria-hidden />
        <span className="text-sm font-semibold">{ti("showcaseLabel")}</span>
        {handle && (
          <a
            href={igUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            @{handle}
          </a>
        )}
      </div>

      <div
        className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          maskImage: "linear-gradient(90deg, transparent, #000 2%, #000 96%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 2%, #000 96%, transparent)",
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={pauseThenResume}
        onTouchMove={pauseThenResume}
      >
        {marquee ? (
          <div
            className="flex w-max animate-[ticker_36s_linear_infinite] gap-3"
            style={{ animationPlayState: paused ? "paused" : "running" }}
          >
            <ul className="flex list-none gap-3">{renderList(false)}</ul>
            <ul className="flex list-none gap-3" aria-hidden>
              {renderList(true)}
            </ul>
          </div>
        ) : (
          <ul className="flex list-none gap-3">{renderList(false)}</ul>
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label={ti("close")}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.mediaUrl}
            alt={lightbox.caption ?? ""}
            className="max-h-[85vh] max-w-full rounded-[var(--radius-md)] object-contain"
          />
        </div>
      )}
    </section>
  );
}
