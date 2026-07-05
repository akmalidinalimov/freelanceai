"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Profile hero banner — an image, or a short showreel video that autoplays muted+looped.
 *
 * PERFORMANCE CONTRACT (founder: "autoplay but must not impact load speed"):
 *   - The POSTER image is the only thing in the initial paint (it's the `poster` attr /
 *     the <img> src) — it's the LCP frame and costs one small image request.
 *   - The VIDEO's bytes are NOT fetched during page load: the <video> ships with no `src`
 *     and `preload="none"`. A client effect assigns the source and calls play() ONLY after
 *     the page goes idle (requestIdleCallback) — so the showreel never competes with the
 *     critical render path.
 *   - It stays a still poster (no video fetch at all) when the visitor has reduced-motion
 *     on, Save-Data on, or a 2g/slow connection — protecting a data-conscious mobile market.
 */
export function ProfileBanner({
  url,
  type,
  poster,
}: {
  url: string;
  type: string;
  poster: string | null;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    if (type !== "video") return;
    // Respect the visitor's motion + data preferences before spending any bytes.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (reduce || conn?.saveData || (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType))) return;

    let done = false;
    const start = () => {
      if (done) return;
      done = true;
      setPlay(true); // assign <source> now (post-idle) → this is when video bytes load
    };
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: object) => number })
      .requestIdleCallback;
    const id = ric ? ric(start, { timeout: 2500 }) : window.setTimeout(start, 1200);
    return () => {
      const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (ric && cic) cic(id as number);
      else clearTimeout(id as number);
    };
  }, [type]);

  useEffect(() => {
    if (play && ref.current) ref.current.play().catch(() => {});
  }, [play]);

  const box =
    "relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] sm:aspect-[5/2]";

  if (type === "video") {
    return (
      <div className={box}>
        <video
          ref={ref}
          poster={poster ?? undefined}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          className="h-full w-full object-cover"
        >
          {play && <source src={url} />}
        </video>
      </div>
    );
  }

  return (
    <div className={box}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" fetchPriority="high" />
    </div>
  );
}
