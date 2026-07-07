"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

/** A video gig cover inside a 16:9 card frame. Shows the poster (first frame) + a play
 *  badge by default. On desktop (hover-capable) it plays the muted loop on hover; on touch
 *  devices (no hover) it autoplays when the card scrolls into view. The full video plays on
 *  the gig page. Reduced-motion opts out of autoplay. Fills its parent (which sets 16:9). */
export function GigCoverVideo({
  url,
  poster,
  focal,
  className = "",
}: {
  url: string;
  poster?: string | null;
  focal?: string | null;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const pos = focal ?? "center";

  const play = () => {
    const v = ref.current;
    if (!v) return;
    v.play().then(() => setPlaying(true)).catch(() => {});
  };
  const stop = () => {
    const v = ref.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    setPlaying(false);
  };

  // Touch / no-hover devices: autoplay the muted loop while the card is in view. Desktop
  // keeps hover-to-play (below); reduced-motion opts out on every device.
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;
    const noHover = window.matchMedia?.("(hover: none)").matches;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!noHover || reduce) return;
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) play();
          else stop();
        }
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative h-full w-full ${className}`}
      onMouseEnter={play}
      onMouseLeave={stop}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={ref}
        src={url}
        poster={poster ?? undefined}
        muted
        loop
        playsInline
        preload="none"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        style={{ objectPosition: pos }}
      />
      {!playing && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm ring-1 ring-white/25">
            <Play className="h-4 w-4 translate-x-px fill-white" strokeWidth={0} />
          </span>
        </span>
      )}
    </div>
  );
}
