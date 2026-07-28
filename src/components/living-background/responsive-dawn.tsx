"use client";

import { useEffect, useRef } from "react";

/**
 * Living Background — Concept 3: "Responsive Dawn" (interactive gradient).
 * The warm gradient drifts autonomously (CSS) AND leans gently toward pointer /
 * scroll on desktop (heavily damped — ambient, not a toy), and shifts palette by
 * local time of day: morning gold → day neutral → evening rose. Mobile gets the
 * autonomous drift only. Reduced-motion → fully static. rAF-throttled, tiny.
 */
export function ResponsiveDawn() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const h = new Date().getHours();
    el.dataset.phase = h < 11 ? "morning" : h < 17 ? "day" : "evening";

    // Mobile: autonomous CSS drift only — no pointer/scroll listeners.
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let tx = 0,
      ty = 0,
      cx = 0,
      cy = 0,
      raf = 0;
    const tick = () => {
      raf = 0;
      cx += (tx - cx) * 0.04;
      cy += (ty - cy) * 0.04;
      el.style.setProperty("--dx", (cx * 6).toFixed(2) + "%");
      el.style.setProperty("--dy", (cy * 6).toFixed(2) + "%");
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(tick);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
      schedule();
    };
    const onScroll = () => {
      ty = Math.min(Math.max(window.scrollY / window.innerHeight - 0.3, -0.5), 0.5);
      schedule();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden data-phase="day" className="lb3 absolute inset-0 z-0 overflow-hidden">
      <style>{`
        @keyframes lb3drift{0%,100%{background-position:calc(30% + var(--dx,0%)) calc(30% + var(--dy,0%))}50%{background-position:calc(70% + var(--dx,0%)) calc(62% + var(--dy,0%))}}
        .lb3-layer{position:absolute;inset:0;background-size:180% 180%;animation:lb3drift 40s ease-in-out infinite;will-change:background-position}
        .lb3[data-phase="morning"] .lb3-layer{background-image:radial-gradient(60% 55% at 40% 40%, hsl(42 92% 66% / .5), transparent 60%), radial-gradient(55% 50% at 70% 60%, hsl(14 90% 70% / .4), transparent 60%)}
        .lb3[data-phase="day"] .lb3-layer{background-image:radial-gradient(60% 55% at 40% 40%, hsl(32 85% 70% / .42), transparent 60%), radial-gradient(55% 50% at 70% 60%, hsl(20 72% 72% / .34), transparent 60%)}
        .lb3[data-phase="evening"] .lb3-layer{background-image:radial-gradient(60% 55% at 40% 40%, hsl(348 85% 72% / .5), transparent 60%), radial-gradient(55% 50% at 70% 60%, hsl(12 82% 66% / .42), transparent 60%)}
        @media (prefers-reduced-motion:reduce){.lb3-layer{animation:none}}
      `}</style>
      <div className="lb3-layer" />
      {/* Veil keeps text readable across every phase and both themes (embers via veil in dark). */}
      <div className="absolute inset-0 bg-[hsl(var(--background))]/72" />
    </div>
  );
}
