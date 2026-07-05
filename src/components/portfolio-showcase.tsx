"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Instagram, Play, X } from "lucide-react";

type Item = {
  id: string;
  mediaUrl: string;
  mediaType: string;
  permalink: string | null;
  caption: string | null;
  source: string; // "instagram" | "upload"
};

/**
 * A creator's visual portfolio: one "zoom-grid" that MERGES their sources — manual
 * uploads and synced Instagram — into a single showcase (a few tiles periodically
 * zoom; `.ig-zoom-grid` + `ig-zoom` in globals.css, calm under reduced-motion). Each
 * tile carries a small source glyph (Instagram vs. a plain upload) so it's honest about
 * provenance but still reads as one portfolio. Telegram-channel posts render in their
 * own block (embeds, not tiles). Renders nothing when empty.
 */
export function PortfolioShowcase({ items, igHandle }: { items: Item[]; igHandle: string | null }) {
  const tp = useTranslations("Profile");
  const ti = useTranslations("Instagram");
  const [lightbox, setLightbox] = useState<Item | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLightbox(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  if (items.length === 0) return null;

  const Tile = ({ p, eager }: { p: Item; eager: boolean }) => {
    const isVideo = p.mediaType === "video";
    const fromIg = p.source === "instagram";
    const inner = (
      <span className="relative block aspect-square overflow-hidden rounded-[var(--radius-md)] border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.mediaUrl}
          alt={p.caption ?? ""}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover"
        />
        {/* Source glyph: only Instagram tiles get a badge; uploads stay clean. */}
        {fromIg && (
          <span className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
            <Instagram className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
        {isVideo && (
          <span className="absolute inset-0 grid place-items-center" aria-hidden>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-black/50 pl-0.5 text-white backdrop-blur-sm">
              <Play className="h-4 w-4 fill-white" />
            </span>
          </span>
        )}
      </span>
    );
    return p.permalink ? (
      <a href={p.permalink} target="_blank" rel="noopener noreferrer" aria-label={tp("portfolio")} className="block">
        {inner}
      </a>
    ) : (
      <button type="button" onClick={() => setLightbox(p)} aria-label={tp("portfolio")} className="block w-full">
        {inner}
      </button>
    );
  };

  return (
    <section aria-label={tp("portfolio")} className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold">{tp("portfolio")}</span>
        {igHandle && (
          <a
            href={`https://www.instagram.com/${igHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <Instagram className="h-3.5 w-3.5" aria-hidden /> @{igHandle}
          </a>
        )}
      </div>

      <ul className="ig-zoom-grid grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((p, i) => (
          <li key={p.id} className="relative isolate list-none">
            <Tile p={p} eager={i < 4} />
          </li>
        ))}
      </ul>

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
