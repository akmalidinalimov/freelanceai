"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

/** Parse a CSS object-position "x% y%" into {x,y} (0–100); default center. */
function parse(v?: string): { x: number; y: number } {
  const m = (v ?? "").match(/^(\d{1,3}(?:\.\d)?)%\s+(\d{1,3}(?:\.\d)?)%$/);
  if (!m) return { x: 50, y: 50 };
  return { x: Math.min(100, Math.max(0, Number(m[1]))), y: Math.min(100, Math.max(0, Number(m[2]))) };
}

/**
 * Cover focal-point picker (no zoom, no library). The creator clicks/drags to choose which
 * area of their cover stays centered — so any frame (4:5 featured, 16:9 card) crops sensibly.
 * Emits a CSS object-position string ("x% y%").
 */
export function FocalPicker({
  src,
  value,
  onChange,
}: {
  src: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("Gig");
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const pos = parse(value);
  const focal = `${pos.x}% ${pos.y}%`;

  function setFromEvent(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)));
    onChange(`${x}% ${y}%`);
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{t("coverFocalLabel")}</span>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">{t("coverFocalHint")}</span>
      </div>
      <div className="flex flex-wrap gap-3">
        {/* Interactive image — click/drag to move the focal point */}
        <div
          ref={ref}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag(true);
            setFromEvent(e);
          }}
          onPointerMove={(e) => drag && setFromEvent(e)}
          onPointerUp={() => setDrag(false)}
          className="relative min-w-[220px] flex-1 cursor-crosshair touch-none select-none overflow-hidden rounded-lg border border-[hsl(var(--border))]"
          style={{ aspectRatio: "16 / 9" }}
          role="button"
          aria-label={`${t("coverFocalLabel")} — ${focal}`}
          tabIndex={0}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="h-full w-full object-cover" style={{ objectPosition: focal }} draggable={false} />
          <span
            className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,.35)]"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, background: "hsl(var(--primary) / .35)" }}
            aria-hidden
          />
        </div>
        {/* Live 4:5 preview (how it frames in the featured loop) */}
        <div className="w-[132px] shrink-0">
          <div className="overflow-hidden rounded-lg border border-[hsl(var(--border))]" style={{ aspectRatio: "4 / 5" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" style={{ objectPosition: focal }} draggable={false} />
          </div>
          <p className="mt-1 text-center text-[11px] text-[hsl(var(--muted-foreground))]">{t("coverFocalPreview")}</p>
        </div>
      </div>
    </div>
  );
}
