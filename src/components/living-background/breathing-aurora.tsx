/**
 * Living Background — Concept 1: "Breathing Aurora" (pure CSS, zero JS).
 * Large, very-blurred warm radial blobs drifting on slow independent paths
 * behind a translucent veil so foreground text always sits on a near-solid
 * surface. Weightless: no JS, no canvas. Reduced-motion → the blobs hold still.
 * Uses the --gradient-* tokens, so it dims to embers automatically in dark mode.
 */
export function BreathingAurora() {
  return (
    <div aria-hidden className="absolute inset-0 z-0 overflow-hidden">
      <style>{`
        @keyframes lb1a{0%,100%{transform:translate3d(-6%,-4%,0) scale(1)}50%{transform:translate3d(6%,4%,0) scale(1.18)}}
        @keyframes lb1b{0%,100%{transform:translate3d(5%,-3%,0) scale(1.12)}50%{transform:translate3d(-6%,5%,0) scale(1)}}
        @keyframes lb1c{0%,100%{transform:translate3d(-3%,6%,0) scale(1.05)}50%{transform:translate3d(7%,-5%,0) scale(1.2)}}
        .lb1-blob{position:absolute;border-radius:9999px;filter:blur(72px);will-change:transform}
        @media (prefers-reduced-motion:reduce){.lb1-blob{animation:none!important}}
      `}</style>
      <span
        className="lb1-blob"
        style={{
          width: "46rem",
          height: "46rem",
          top: "-16rem",
          left: "-10rem",
          background: "radial-gradient(closest-side, hsl(var(--gradient-a) / 0.55), transparent 70%)",
          animation: "lb1a 44s ease-in-out infinite",
        }}
      />
      <span
        className="lb1-blob"
        style={{
          width: "40rem",
          height: "40rem",
          top: "-8rem",
          right: "-12rem",
          background: "radial-gradient(closest-side, hsl(var(--gradient-b) / 0.5), transparent 70%)",
          animation: "lb1b 52s ease-in-out infinite",
        }}
      />
      <span
        className="lb1-blob"
        style={{
          width: "38rem",
          height: "38rem",
          bottom: "-18rem",
          left: "28%",
          background: "radial-gradient(closest-side, hsl(var(--gradient-c) / 0.45), transparent 70%)",
          animation: "lb1c 60s ease-in-out infinite",
        }}
      />
      {/* Veil: keeps text on a near-solid surface (contrast unchanged). */}
      <div className="absolute inset-0 bg-[hsl(var(--background))]/72" />
    </div>
  );
}
