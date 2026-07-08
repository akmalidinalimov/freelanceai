"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { HomeSearch } from "./home-search";

type HeroGig = {
  slug: string;
  title: string;
  coverUrl: string | null;
  coverType: string | null;
  coverFocal: string | null;
};
type HeroCreator = { username: string | null; name: string; avatar: string | null; ratingAvg: number };

/**
 * Marketplace hero (founder-approved mockup ported live). A self-contained dark
 * surface with a particle-net canvas, ghost GIGORA⇄ГИГОРА wordmark, buyer/creator
 * toggle, the real AI concierge search, count-up stats, and floating gig/creator
 * cards. Mobile-first: the canvas density scales down on touch, the stage becomes
 * a swipe row, and pointer-parallax is desktop-only.
 */
export function MarketHero({
  stats,
  gigs,
  creators,
}: {
  stats: { gigs: number; creators: number };
  gigs: HeroGig[];
  creators: HeroCreator[];
}) {
  const t = useTranslations("Home");
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const creatorsRef = useRef<HTMLSpanElement>(null);
  const gigsRef = useRef<HTMLSpanElement>(null);
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
      DPR = 1,
      raf = 0,
      px = -999,
      py = -999;
    let pts: { x: number; y: number; vx: number; vy: number }[] = [];

    const size = () => {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      const r = root.getBoundingClientRect();
      W = r.width;
      H = Math.max(r.height, 560);
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

    const pointer = (x: number, y: number) => {
      const r = root.getBoundingClientRect();
      px = x - r.left;
      py = y - r.top;
      if (reduce || touch) return;
      const mx = px / r.width - 0.5;
      const my = py / r.height - 0.5;
      root.querySelectorAll<HTMLElement>(".mh-card").forEach((c) => {
        const d = Number(c.getAttribute("data-depth") || "0");
        c.style.transform = `translate(${mx * d}px, ${my * d * 0.7}px)`;
      });
    };
    const onMove = (e: MouseEvent) => pointer(e.clientX, e.clientY);
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

    // count-up (respects reduced motion)
    const count = (el: HTMLElement | null, to: number) => {
      if (!el) return undefined;
      if (reduce || to <= 0) {
        el.textContent = String(Math.max(0, to));
        return undefined;
      }
      let s = 0;
      const step = Math.max(1, Math.round(to / 40));
      const iv = setInterval(() => {
        s += step;
        if (s >= to) {
          s = to;
          clearInterval(iv);
        }
        el.textContent = String(s);
      }, 28);
      return iv;
    };
    const iv1 = count(creatorsRef.current, stats.creators);
    const iv2 = count(gigsRef.current, stats.gigs);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
      if (iv1) clearInterval(iv1);
      if (iv2) clearInterval(iv2);
    };
  }, [stats.creators, stats.gigs]);

  const cards = gigs.slice(0, 2);
  const crew = creators.slice(0, 3);

  const h1a = mode === 0 ? t("searchHeadline") : t("heroSellHeadline");
  const h1b = mode === 0 ? t("searchHeadline2") : t("heroSellHeadline2");
  const sub = mode === 0 ? t("searchSub") : t("heroSellSub");
  const cta = mode === 0 ? t("heroBuyCta") : t("heroSellCta");
  const ctaHref = mode === 0 ? "/browse" : "/sell";

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
          <div className="mh-left">
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

            <div className="mh-actions">
              <Link href={ctaHref} className="mh-b1">
                {cta} →
              </Link>
              <Link href="/browse" className="mh-b2">
                {t("heroViewWork")}
              </Link>
            </div>

            <div className="mh-stats">
              <div className="mh-stat">
                <div className="v">
                  <b>
                    <span ref={creatorsRef}>0</span>
                  </b>
                </div>
                <div className="l">{t("statCreators")}</div>
              </div>
              <div className="mh-stat">
                <div className="v">
                  <span ref={gigsRef}>0</span>+
                </div>
                <div className="l">{t("statServices")}</div>
              </div>
              <div className="mh-stat">
                <div className="v">24/7</div>
                <div className="l">{t("statSupport")}</div>
              </div>
              <div className="mh-stat">
                <div className="v">3</div>
                <div className="l">{t("statLangs")}</div>
              </div>
            </div>
          </div>

          <div className="mh-stage">
            {cards.length > 0 && (
              <div className="mh-cards">
                {cards.map((g, i) => (
                  <Link
                    key={g.slug}
                    href={`/gigs/${g.slug}`}
                    className={`mh-card c${i + 1}`}
                    data-depth={i === 0 ? 16 : 30}
                  >
                    <div className="bar">
                      <i style={{ background: "#ff5f57" }} />
                      <i style={{ background: "#febc2e" }} />
                      <i style={{ background: "#28c840" }} />
                      <span className="t">gigora.ai</span>
                    </div>
                    <div className="cov">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={g.coverUrl ?? "/prism/pattern-sweep-dark-wide-v1.webp"}
                        alt=""
                        loading="lazy"
                        style={{ objectPosition: g.coverFocal ?? "center" }}
                      />
                      <span className="tag">{g.coverType === "video" ? "▶ VIDEO" : "● AI"}</span>
                      <span className="cap">{g.title}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {crew.length > 0 && (
              <div className="mh-crew">
                {crew.map((c, i) => (
                  <Link
                    key={c.username ?? i}
                    href={c.username ? `/creators/${c.username}` : "/creators"}
                    className={`mh-av a${i + 1}`}
                  >
                    <span className="a">
                      {c.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.avatar} alt="" />
                      ) : (
                        (c.name.trim()[0] ?? "•").toUpperCase()
                      )}
                      <span className="on" />
                    </span>
                    <span className="nm">{c.name || "Gigora"}</span>
                    <span className="rt">{(c.ratingAvg > 0 ? c.ratingAvg : 5).toFixed(1)}★</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
