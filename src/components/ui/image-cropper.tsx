"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { decodeImageBounded, isDecodeFailure } from "@/lib/image-decode";
import { NATIVE_IMAGE_TYPES } from "@/lib/image-normalize";

/**
 * Interactive crop dialog: drag to pan, slider to zoom, then Apply.
 *
 * Accepts ANY image the browser can decode and always outputs a webp blob at a fixed output
 * size, so storage only ever holds one predictable format.
 *
 * Decoding goes through decodeImageBounded, which caps the longest edge. The full-size decode this
 * replaced could not survive a modern phone photo: 50-200MP is hundreds of MB as a bitmap, the
 * WebView gave up, and the resulting onerror was reported to the user as "try a JPG or PNG" about
 * a file that already was one. Nothing is lost by bounding it — the output here is a few hundred
 * pixels, so 2048 is already far more detail than can survive the crop.
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
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<null | "heic" | "undecodable">(null);
  const [preview, setPreview] = useState<string | null>(null);
  const decoded = useRef<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const bitmap = useRef<CanvasImageSource | null>(null);

  // Decode once, bounded, and build the preview from the DECODED pixels. Pointing an <img> at the
  // original was the third place full resolution was being held in memory at the same time.
  useEffect(() => {
    let cancelled = false;
    let release: (() => void) | null = null;
    let previewUrl: string | null = null;

    (async () => {
      const res = await decodeImageBounded(file, 2048);
      if (cancelled) {
        if (!isDecodeFailure(res)) res.close();
        return;
      }
      if (isDecodeFailure(res)) {
        setFailed(res.reason);
        return;
      }
      release = res.close;
      bitmap.current = res.source;
      decoded.current = { width: res.width, height: res.height };

      // Re-encode the bounded image for display so the <img> holds the small copy, not the original.
      const c = document.createElement("canvas");
      c.width = res.width;
      c.height = res.height;
      c.getContext("2d")?.drawImage(res.source, 0, 0);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", 0.92));
      if (cancelled) return;
      if (blob) {
        previewUrl = URL.createObjectURL(blob);
        setPreview(previewUrl);
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
      release?.();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      bitmap.current = null;
      decoded.current = null;
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
      const d = decoded.current;
      if (!d || !frame.w) return 1;
      return Math.max(frame.w / d.width, frame.h / d.height) * z;
    },
    [frame.w, frame.h]
  );

  const clamp = useCallback(
    (p: { x: number; y: number }, z: number) => {
      const d = decoded.current;
      if (!d) return p;
      const s = scaleOf(z);
      const minX = frame.w - d.width * s;
      const minY = frame.h - d.height * s;
      return { x: Math.min(0, Math.max(minX, p.x)), y: Math.min(0, Math.max(minY, p.y)) };
    },
    [frame.w, frame.h, scaleOf]
  );

  // Center the image whenever the frame or zoom baseline changes.
  useEffect(() => {
    const d = decoded.current;
    if (!d || !frame.w) return;
    const s = scaleOf(zoom);
    setPos(clamp({ x: (frame.w - d.width * s) / 2, y: (frame.h - d.height * s) / 2 }, zoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.w, frame.h, ready]);

  function onZoom(z: number) {
    if (!decoded.current) return;
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
    const img = bitmap.current;
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

  const s = decoded.current ? scaleOf(zoom) : 1;

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-[var(--shadow-overlay)]">
        <p className="mb-3 font-semibold">{t("cropTitle")}</p>

        {failed ? (
          <div className="mb-3">
            <p className="text-sm text-[hsl(var(--danger))]">
              {failed === "heic" ? t("cropHeic") : t("cropUnsupported")}
            </p>
            {/* Never dead-end a format storage would happily accept. If we could not crop a JPEG or
                PNG, uploading it uncropped is strictly better than refusing the picture outright. */}
            {NATIVE_IMAGE_TYPES.includes(file.type) && (
              <button
                type="button"
                onClick={() => onCropped(file)}
                className="mt-3 w-full rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm font-medium"
              >
                {t("cropSkip")}
              </button>
            )}
          </div>
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
              {ready && preview && decoded.current && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt=""
                  draggable={false}
                  style={{
                    position: "absolute",
                    left: pos.x,
                    top: pos.y,
                    width: decoded.current.width * s,
                    height: decoded.current.height * s,
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
