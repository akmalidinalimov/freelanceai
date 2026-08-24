"use client";

import { useEffect, useState } from "react";

/**
 * Living Background — Concept 2: "Ambient Film" (video, Fiverr-style).
 * A slow, abstract warm loop under a strong scrim. The animated warm gradient
 * below is the always-visible base / poster / reduced-motion fallback; the
 * <video> lazy-mounts only after first paint and only when it won't hurt the
 * experience (not reduced-motion, not save-data, not a small screen).
 *
 * NOTE: no licensed loop asset is wired yet — pass `src` (an <4MB muted mp4/webm)
 * once the founder approves one; until then this renders as the gradient
 * prototype so it can be compared live. Note the asset's license in the PR.
 */
export function AmbientFilm({ src, poster }: { src?: string; poster?: string }) {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    if (!src) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 640px)").matches;
    const saveData = (navigator as unknown as { connection?: { saveData?: boolean } }).connection
      ?.saveData;
    if (reduce || small || saveData) return;

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (h: number) => void;
    };
    const start = () => setPlay(true);
    const handle = w.requestIdleCallback ? w.requestIdleCallback(start) : window.setTimeout(start, 400);
    return () => {
      if (w.cancelIdleCallback) w.cancelIdleCallback(handle);
      else clearTimeout(handle);
    };
  }, [src]);

  return (
    <div aria-hidden className="absolute inset-0 z-0 overflow-hidden">
      <style>{`
        @keyframes lb2{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        .lb2-poster{background:linear-gradient(120deg, hsl(var(--gradient-a) / 0.5), hsl(var(--gradient-b) / 0.45) 45%, hsl(var(--gradient-c) / 0.5));background-size:220% 220%;animation:lb2 30s ease-in-out infinite}
        @media (prefers-reduced-motion:reduce){.lb2-poster{animation:none}}
      `}</style>
      <div className="lb2-poster absolute inset-0" />
      {play && src && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster={poster}
        >
          <source src={src} />
        </video>
      )}
      {/* Strong scrim: video/gradient stays a mood, text stays readable. */}
      <div className="absolute inset-0 bg-[hsl(var(--background))]/78" />
    </div>
  );
}
