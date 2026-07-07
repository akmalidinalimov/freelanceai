"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";

/** A video gig cover inside a 16:9 card frame. Shows the poster (first frame) + a play
 *  badge by default — light on mobile data — and plays the muted loop on hover (desktop).
 *  The full video plays on the gig page. Fills its parent (which sets the 16:9 aspect). */
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
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const pos = focal ?? "center";

  return (
    <div
      className={`relative h-full w-full ${className}`}
      onMouseEnter={() => {
        const v = ref.current;
        if (!v) return;
        v.play().then(() => setPlaying(true)).catch(() => {});
      }}
      onMouseLeave={() => {
        const v = ref.current;
        if (!v) return;
        v.pause();
        v.currentTime = 0;
        setPlaying(false);
      }}
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
