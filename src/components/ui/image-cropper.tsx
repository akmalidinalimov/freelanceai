"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Interactive crop dialog: drag to pan, slider to zoom, then Apply.
 *
 * Accepts ANY image the browser can decode (iPhone HEIC on Safari, GIF, BMP…) and
 * always outputs a webp blob at a fixed output size — so the server only ever stores
 * one predictable format and the narrow upload allowlist can't reject a phone photo.
 */
export function ImageCropper({
  file,
  aspect = 1,
  outWidth = 512,
  onCancel,
  onCropped,
}: {
  file: File;
  /** width / height of the crop frame (1 = square, 16/9 = cover banner). */
  aspect?: number;
  outWidth?: number;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
}) {
  const t = useTranslations("Profile");
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const objectUrl = useRef<string | null>(null);

  // Decode the picked file once. Any decode failure is surfaced (not silently ignored).
  useEffect(() => {
    const url = URL.createObjectURL(file);
    objectUrl.current = url;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
    };
    img.onerror = () => setFailed(true);
    img.src = url;
    return () => {
      URL.revokeObjectURL(url);
      objectUrl.current = null;
    };
  }, [file]);

  // Measure the crop frame (responsive: it fills the dialog width).
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      setFrame({ w, h: Math.round(w / aspect) });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [aspect, ready]);

  /** Cover-fit scale for the current zoom. */
  const scaleOf = useCallback(
    (z: number) => {
      const img = imgRef.current;
      if (!img || !frame.w) return 1;
      return Math.max(frame.w / img.naturalWidth, frame.h / img.naturalHeight) * z;
    },
    [frame.w, frame.h]
  );

  const clamp = useCallback(
    (p: { x: number; y: number }, z: number) => {
      const img = imgRef.current;
      if (!img) return p;
      const s = scaleOf(z);
      const minX = frame.w - img.naturalWidth * s;
      const minY = frame.h - img.naturalHeight * s;
      return { x: Math.min(0, Math.max(minX, p.x)), y: Math.min(0, Math.max(minY, p.y)) };
    },
    [frame.w, frame.h, scaleOf]
  );

  // Center the image whenever the frame or zoom baseline changes.
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !frame.w) return;
    const s = scaleOf(zoom);
    setPos(clamp({ x: (frame.w - img.naturalWidth * s) / 2, y: (frame.h - img.naturalHeight * s) / 2 }, zoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.w, frame.h, ready]);

  function onZoom(z: number) {
    const img = imgRef.current;
    if (!img) return;
    // Keep the frame's center point stable while zooming.
    const oldS = scaleOf(zoom);
    const newS = scaleOf(z);
    const cx = (frame.w / 2 - pos.x) / oldS;
    const cy = (frame.h / 2 - pos.y) / oldS;
    setZoom(z);
    setPos(clamp({ x: frame.w / 2 - cx * newS, y: frame.h / 2 - cy * newS }, z));
  }

  function down(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  }
  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    setPos(clamp({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) }, zoom));
  }
  const up = () => {
    drag.current = null;
  };

  async function apply() {
    const img = imgRef.current;
    if (!img) return;
    const s = scaleOf(zoom);
    const outHeight = Math.round(outWidth / aspect);
    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Source rect = the part of the natural image currently inside the frame.
    ctx.drawImage(img, -pos.x / s, -pos.y / s, frame.w / s, frame.h / s, 0, 0, outWidth, outHeight);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.9));
    if (blob) onCropped(blob);
  }

  const s = imgRef.current ? scaleOf(zoom) : 1;

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-[var(--shadow-overlay)]">
        <p className="mb-3 font-semibold">{t("cropTitle")}</p>

        {failed ? (
          <p className="mb-3 text-sm text-[hsl(var(--danger))]">{t("cropUnsupported")}</p>
        ) : (
          <>
            <div
              ref={frameRef}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              style={{ height: frame.h || undefined }}
              className={`relative touch-none overflow-hidden bg-[hsl(var(--muted))] ${
                aspect === 1 ? "rounded-full" : "rounded-lg"
              }`}
            >
              {ready && imgRef.current && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={objectUrl.current ?? ""}
                  alt=""
                  draggable={false}
                  style={{
                    position: "absolute",
                    left: pos.x,
                    top: pos.y,
                    width: imgRef.current.naturalWidth * s,
                    height: imgRef.current.naturalHeight * s,
                    cursor: "grab",
                  }}
                />
              )}
            </div>
            <label className="mt-3 block text-xs text-[hsl(var(--muted-foreground))]">
              {t("cropZoom")}
              <input
                type="range"
                min={1}
                max={4}
                step={0.02}
                value={zoom}
                onChange={(e) => onZoom(Number(e.target.value))}
                className="mt-1 w-full"
                aria-label={t("cropZoom")}
              />
            </label>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{t("cropHint")}</p>
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm font-medium"
          >
            {t("cropCancel")}
          </button>
          {!failed && (
            <button
              type="button"
              onClick={apply}
              disabled={!ready}
              className="rounded-md bg-[hsl(var(--primary))] px-4 py-1.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] disabled:opacity-50"
            >
              {t("cropApply")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
