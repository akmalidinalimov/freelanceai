/**
 * Amber Classic — the founder-chosen living background (design-warm-bg6 #1).
 * Milky warm canvas + subtle drifting dot grid + three morphing warm pigment
 * washes (terracotta / amber / honey) under a thin milk veil. Fixed and
 * page-wide; sits behind all content. Motion collapses under reduced-motion
 * via the global rule in globals.css.
 */
export function AmberClassic() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* drifting dot grid — quiet paper texture */}
      <div className="amber-dots absolute -inset-10" />
      {/* warm pigment washes */}
      <div
        className="amber-wash absolute opacity-60"
        style={{
          width: "54vmax", height: "42vmax", left: "-10vmax", top: "-12vmax",
          background: "hsl(14 88% 62%)",
          animation: "amber-morph-a 30s ease-in-out infinite alternate",
        }}
      />
      <div
        className="amber-wash absolute opacity-[.55]"
        style={{
          width: "46vmax", height: "38vmax", right: "-8vmax", top: "18vmax",
          background: "hsl(38 95% 60%)",
          animation: "amber-morph-b 38s ease-in-out infinite alternate",
        }}
      />
      <div
        className="amber-wash absolute opacity-[.58]"
        style={{
          width: "40vmax", height: "32vmax", left: "28vmax", bottom: "-14vmax",
          background: "hsl(26 95% 66%)",
          animation: "amber-morph-a 34s ease-in-out infinite alternate-reverse",
        }}
      />
      {/* milk veil keeps everything readable */}
      <div className="absolute inset-0 bg-[hsl(40_45%_97.5%/.22)]" />
      {/* soft glow behind the hero so text floats on milk */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(46rem 30rem at 50% 24rem, hsl(40 45% 98% / .74), transparent 72%)",
        }}
      />
    </div>
  );
}
