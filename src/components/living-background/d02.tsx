/**
 * D02 "Blueprint Grid + Accent Glow" — the founder-chosen DARK premium homepage world.
 * A cool charcoal canvas, hairline blueprint grid (radial-masked so it fades at the edges),
 * a slow travelling blue beam glow, and a vignette that sinks the corners. Pure CSS.
 *
 * Like AmberClassic, this MUST be mounted at the page root (not inside a positioned /
 * isolated ancestor), so the fixed layer fills the viewport instead of being trapped.
 * It paints an opaque canvas, so it sits above the global AmberClassic on the homepage.
 */
export function D02Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ background: "#0a0c12" }}>
      {/* hairline blueprint grid, faded toward the edges with a radial mask */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(120,140,180,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(120,140,180,.09) 1px,transparent 1px)",
          backgroundSize: "52px 52px",
          WebkitMaskImage: "radial-gradient(120% 100% at 50% 34%,#000 55%,transparent 100%)",
          maskImage: "radial-gradient(120% 100% at 50% 34%,#000 55%,transparent 100%)",
        }}
      />
      {/* travelling blue accent beam */}
      <div
        className="absolute motion-reduce:animate-none"
        style={{
          width: "60vw",
          height: "60vw",
          top: "-10%",
          left: "-10%",
          borderRadius: "50%",
          filter: "blur(80px)",
          opacity: 0.5,
          mixBlendMode: "screen",
          background: "radial-gradient(circle,hsl(212 90% 56%) 0%,transparent 64%)",
          animation: "d02-beam-sweep 22s linear infinite",
        }}
      />
      {/* corner vignette */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 40%,transparent 46%,rgba(3,4,8,.85) 100%)" }}
      />
    </div>
  );
}
