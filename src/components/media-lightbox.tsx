"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const isVideo = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

/**
 * Full-screen media lightbox rendered in a portal above everything.
 * Esc closes, ←/→ navigate, backdrop click closes, focus is trapped and returned
 * to the trigger on close. Images use object-contain so portraits never overflow;
 * videos get native controls.
 */
export function MediaLightbox({
  images,
  index,
  onIndex,
  onClose,
  labels,
}: {
  images: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  labels: { close: string; prev: string; next: string };
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const many = images.length > 1;

  const go = useCallback(
    (dir: number) => onIndex((index + dir + images.length) % images.length),
    [index, images.length, onIndex]
  );

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && many) go(1);
      else if (e.key === "ArrowLeft" && many) go(-1);
      else if (e.key === "Tab") {
        // Simple trap: keep focus on the dialog container.
        e.preventDefault();
        dialogRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [go, many, onClose]);

  const url = images[index];

  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 outline-none"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label={labels.close}
        onClick={onClose}
        className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      {many && (
        <>
          <button
            type="button"
            aria-label={labels.prev}
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label={labels.next}
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white tabular-nums">
            {index + 1} / {images.length}
          </span>
        </>
      )}

      <div className="max-h-[88vh] max-w-5xl" onClick={(e) => e.stopPropagation()}>
        {isVideo(url) ? (
          <video src={url} controls autoPlay className="max-h-[88vh] max-w-full rounded-[var(--radius-md)]" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="max-h-[88vh] max-w-full rounded-[var(--radius-md)] object-contain"
          />
        )}
      </div>
    </div>,
    document.body
  );
}
