"use client";

import { useEffect, useRef } from "react";

/**
 * BreathingDots — the homepage's signature animated ground (founder direction 2026-07-08).
 * A soft-indigo canvas with a dot field that slowly WAVES (a travelling sine ripple),
 * BREATHES (a global pulse), and brightens toward a drifting light-centre tinted with the
 * brand teal — so the page is alive the moment you land. Pure Canvas 2D, capped at 2× DPR.
 *
 * Opaque, mounted at the page root (like the other backgrounds) so its fixed layer covers
 * the global dot-grid on the homepage. Honours prefers-reduced-motion: renders one calm
 * static frame and never starts the RAF loop.
 */
export function BreathingDots() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const GAP = 34;
    let W = 0, H = 0, cols = 0, rows = 0, t = 0, raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(W / GAP) + 2;
      rows = Math.ceil(H / GAP) + 2;
    };

    // indigo-grey base dot → teal near the light centre
    const FAR = [110, 122, 168];
    const NEAR = [90, 226, 208];

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const lx = W * (0.74 + 0.12 * Math.sin(t * 0.18));
      const ly = H * (0.12 + 0.1 * Math.cos(t * 0.14));
      const breath = 0.5 + 0.5 * Math.sin(t * 0.6);
      const reach = W * 0.55;
      for (let iy = 0; iy < rows; iy++) {
        for (let ix = 0; ix < cols; ix++) {
          const x0 = ix * GAP;
          const y0 = iy * GAP;
          const wav =
            Math.sin(x0 * 0.018 + y0 * 0.012 + t * 0.9) +
            Math.sin(x0 * 0.01 - y0 * 0.02 + t * 0.6);
          const x = x0 + Math.cos(x0 * 0.02 + t * 0.5) * 3.2 * wav * 0.5;
          const y = y0 + wav * 4.2;
          const near = Math.max(0, 1 - Math.hypot(x - lx, y - ly) / reach);
          const pulse = 0.35 + 0.65 * breath * (0.4 + 0.6 * near);
          const rad = 0.7 + near * 1.6 + breath * 0.3;
          const r = Math.round(FAR[0] + (NEAR[0] - FAR[0]) * near);
          const g = Math.round(FAR[1] + (NEAR[1] - FAR[1]) * near);
          const b = Math.round(FAR[2] + (NEAR[2] - FAR[2]) * near);
          ctx.beginPath();
          ctx.fillStyle = `rgba(${r},${g},${b},${0.09 + 0.5 * pulse * near + 0.06 * breath})`;
          ctx.arc(x, y, rad, 0, 6.2832);
          ctx.fill();
        }
      }
      if (!reduce) {
        t += 0.016;
        raf = requestAnimationFrame(draw);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    if (reduce) {
      t = 1.2;
      draw();
    } else {
      raf = requestAnimationFrame(draw);
    }
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: "linear-gradient(165deg, #171b30 0%, #10121f 100%)" }}
    >
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      {/* teal accent glow, top-right, matching the drifting light-centre */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(46% 42% at 76% 10%, hsl(173 70% 40% / .16), transparent 66%)",
          mixBlendMode: "screen",
        }}
      />
      {/* corner vignette sinks the edges */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(122% 90% at 50% 38%, transparent 50%, rgba(7,9,18,.8) 100%)" }}
      />
    </div>
  );
}
