"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MediaLightbox } from "@/components/media-lightbox";
import { CoverFallback } from "@/components/ui/cover-fallback";

/**
 * Gig gallery: large cover + thumbnail row; any click opens the lightbox at that
 * item. Falls back to the initial-letter placeholder when there's no media.
 */
export function GigGallery({ images, title }: { images: string[]; title: string }) {
  const t = useTranslations("Gig");
  const [open, setOpen] = useState<number | null>(null);
  const has = images.length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => has && setOpen(0)}
        disabled={!has}
        aria-label={title}
        className="group mb-5 flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))]/15 to-[hsl(var(--accent))]/15 text-5xl font-bold text-[hsl(var(--primary))] enabled:cursor-zoom-in"
      >
        {has ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={images[0]}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-enabled:group-hover:scale-105"
          />
        ) : (
          <CoverFallback seed={title} label={title} />
        )}
      </button>

      {images.length > 1 && (
        <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((url, i) => (
            <button
              key={url + i}
              type="button"
              onClick={() => setOpen(i)}
              className="aspect-video overflow-hidden rounded-lg border border-[hsl(var(--border))] transition-colors hover:border-[hsl(var(--primary))]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {open !== null && (
        <MediaLightbox
          images={images}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          labels={{ close: t("close"), prev: t("prev"), next: t("next") }}
        />
      )}
    </div>
  );
}
