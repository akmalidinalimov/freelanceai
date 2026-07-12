import { coverVariant } from "@/lib/cover-variant";

const PRISM = "/prism/pattern-sweep-dark-wide-v1.webp";

/**
 * Branded placeholder for a gig with no cover — a per-gig seeded prism pattern + the title
 * initial, matching the gig-card look so every coverless gig is consistent and never a bare
 * letter on a flat panel. Self-contained (fills its parent), so it drops into any aspect-video
 * container. The single seam for per-category AI cover images later (swap the src by category).
 */
export function CoverFallback({ seed, label }: { seed: string; label: string }) {
  const v = coverVariant(seed);
  return (
    <span className="relative block h-full w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PRISM}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        style={{
          objectPosition: v.pos,
          transform: v.flip ? "scaleX(-1)" : undefined,
          filter: `brightness(1.02) contrast(1.06) saturate(1.06)${v.hue ? ` hue-rotate(${v.hue}deg)` : ""}`,
        }}
      />
      <span
        className="font-display absolute inset-0 grid select-none place-items-center text-4xl font-black tracking-tight text-white/90"
        style={{ textShadow: "0 2px 16px hsl(20 20% 10% / .35)" }}
      >
        {(label.slice(0, 1) || "•").toUpperCase()}
      </span>
    </span>
  );
}
