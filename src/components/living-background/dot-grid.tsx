/**
 * DotGridBackground — the quiet inner-page dark ground for the D02 world.
 *
 * The homepage carries the full blueprint grid + travelling beam because it is
 * mostly hero with room for drama. Content-dense product pages (browse, gig
 * detail, creators) should let the creative work be the star, so this ground is
 * deliberately calmer: the same charcoal canvas, a faint DOT lattice (dots recede
 * behind card grids far better than lines, which fight the rectangular layout),
 * and one soft top glow for depth. No animation — nothing competes with content.
 *
 * Like D02Background it MUST mount at the page root (not inside a positioned /
 * isolated ancestor) so the fixed layer fills the viewport. It is the global ground,
 * rendered once in the locale layout; the dark token palette comes from `theme-d02`
 * on <html> (also set in the layout), so every token-based page themes dark. The
 * homepage layers its own opaque D02Background (grid + beam) on top of this.
 */
export function DotGridBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ background: "#0a0c12" }}>
      {/* faint dot lattice, fading toward the edges with a radial mask */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(130,150,190,.10) 1px, transparent 1.4px)",
          backgroundSize: "26px 26px",
          WebkitMaskImage: "radial-gradient(125% 115% at 50% 0%,#000 55%,transparent 100%)",
          maskImage: "radial-gradient(125% 115% at 50% 0%,#000 55%,transparent 100%)",
        }}
      />
      {/* soft top glow for depth (blue, matches the D02 accent — very low intensity) */}
      <div
        className="absolute inset-x-0 top-0 h-[46vh]"
        style={{
          background: "radial-gradient(80% 100% at 50% 0%, hsl(212 80% 40% / .16), transparent 70%)",
          mixBlendMode: "screen",
        }}
      />
      {/* corner vignette to sink the edges */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(125% 90% at 50% 34%,transparent 52%,rgba(3,4,8,.72) 100%)" }}
      />
    </div>
  );
}
