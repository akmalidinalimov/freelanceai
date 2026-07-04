/**
 * Amber Classic — the founder-chosen living background (design-warm-bg6 #1,
 * tuned 2026-07-04 after live review):
 *  - MUST be mounted at the page root, NOT inside a positioned/isolated
 *    section: a positioned ancestor traps the fixed layer in its stacking
 *    context and paints it OVER earlier normal-flow content (the bug that
 *    washed color across the ticker/header on first ship).
 *  - Dot grid now sits ABOVE the washes (Paper & Pigment reading) so the
 *    pattern is clearly visible, per the founder's final decision.
 *  - Washes are lighter + veil stronger so color never fights text/cards:
 *    pigment lives at the edges, content floats on milk.
 */
export function AmberClassic() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* warm pigment washes — edge-weighted, reduced presence */}
      <div
        className="amber-wash absolute opacity-50"
        style={{
          width: "50vmax", height: "40vmax", left: "-14vmax", top: "-14vmax",
          background: "hsl(14 88% 62%)",
          animation: "amber-morph-a 30s ease-in-out infinite alternate",
        }}
      />
      <div
        className="amber-wash absolute opacity-[.42]"
        style={{
          width: "44vmax", height: "36vmax", right: "-12vmax", top: "22vmax",
          background: "hsl(38 95% 60%)",
          animation: "amber-morph-b 38s ease-in-out infinite alternate",
        }}
      />
      <div
        className="amber-wash absolute opacity-[.44]"
        style={{
          width: "38vmax", height: "30vmax", left: "30vmax", bottom: "-18vmax",
          background: "hsl(26 95% 66%)",
          animation: "amber-morph-a 34s ease-in-out infinite alternate-reverse",
        }}
      />
      {/* the dotted pattern — ABOVE the color so it always reads */}
      <div className="amber-dots absolute -inset-10" />
      {/* milk veil keeps content zones calm */}
      <div className="absolute inset-0 bg-[hsl(40_45%_97.5%/.3)]" />
      {/* wide glow clears the center column where text and cards live */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 42rem at 50% 30rem, hsl(40 45% 98% / .8), transparent 75%)",
        }}
      />
    </div>
  );
}
