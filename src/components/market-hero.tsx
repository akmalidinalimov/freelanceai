"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { HomeSearch } from "./home-search";

/**
 * Marketplace hero — a search-first dark surface: particle-net canvas, ghost
 * GIGORA⇄ГИГОРА wordmark, buyer/creator toggle (swaps headline/sub), and the real
 * AI concierge search. Mobile-first; the canvas density scales down on touch and
 * the whole thing is centered with no horizontal overflow.
 */
export function MarketHero() {
  const t = useTranslations("Home");
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<0 | 1>(0);

  useEffect(() => {
    const root = rootRef.current;
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (!root || !cv || !ctx) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const touch = !(window.matchMedia?.("(hover: hover)").matches ?? true);

    let W = 0,
      H = 0,
      raf = 0,
      px = -999,
      py = -999;
    let pts: { x: number; y: number; vx: number; vy: number }[] = [];

    const size = () => {
      const DPR = Math.min(window.devicePixelRatio || 1, 2);
      const r = root.getBoundingClientRect();
      W = r.width;
      H = Math.max(r.height, 460);
      cv.width = W * DPR;
      cv.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const n = Math.min(touch ? 42 : 84, Math.round((W * H) / (touch ? 24000 : 18000)));
      pts = [];
      for (let i = 0; i < n; i++)
        pts.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() * 2 - 1) * 0.22,
          vy: (Math.random() * 2 - 1) * 0.22,
        });
    };
    size();
    window.addEventListener("resize", size);

    const onMove = (e: MouseEvent) => {
      const r = root.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
    };
    const onLeave = () => {
      px = py = -999;
    };
    root.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (!reduce) {
          p.x += p.vx;
          p.y += p.vy;
        }
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j];
          const dx = p.x - q.x,
            dy = p.y - q.y,
            dd = dx * dx + dy * dy;
          if (dd < 14000) {
            const a = (1 - dd / 14000) * 0.16;
            ctx.strokeStyle = `rgba(90,200,190,${a})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
        const md = (p.x - px) * (p.x - px) + (p.y - py) * (p.y - py);
        const near = md < 26000 ? 1 - md / 26000 : 0;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${Math.round(90 + 40 * near)},200,190,${0.35 + 0.5 * near})`;
        ctx.arc(p.x, p.y, 1 + near * 1.5, 0, 6.2832);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  const h1a = mode === 0 ? t("searchHeadline") : t("heroSellHeadline");
  const h1b = mode === 0 ? t("searchHeadline2") : t("heroSellHeadline2");
  const sub = mode === 0 ? t("searchSub") : t("heroSellSub");

  return (
    <section ref={rootRef} className="mh-root" aria-label={t("eyebrowMarket")}>
      <canvas ref={canvasRef} className="mh-canvas" aria-hidden />
      <div className="mh-ghost" aria-hidden>
        <div className="tk">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i}>GIGORA ⇄ ГИГОРА ✦ </span>
          ))}
        </div>
      </div>

      <div className="mh-content">
        <div className="mh-hero">
          <div className="mh-toprow">
            <span className="mh-toggle" role="tablist" aria-label={t("eyebrowMarket")}>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 0}
                className={mode === 0 ? "on" : ""}
                onClick={() => setMode(0)}
              >
                {t("heroBuyTab")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 1}
                className={mode === 1 ? "on" : ""}
                onClick={() => setMode(1)}
              >
                {t("heroSellTab")}
              </button>
            </span>
            <span className="mh-eyebrow">
              <span className="d" />
              {t("eyebrowMarket")}
            </span>
          </div>

          <h1 className="mh-h1 font-display">
            {h1a} <span className="a">{h1b}</span>
          </h1>
          <p className="mh-sub">{sub}</p>

          <div className="mh-searchwrap">
            <HomeSearch />
          </div>
        </div>
      </div>
    </section>
  );
}
