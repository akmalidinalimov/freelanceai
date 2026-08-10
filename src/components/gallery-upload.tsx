"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

const MAX = 8;
const MAX_IMAGE = 12 * 1024 * 1024; // pre-normalize; we re-encode images to webp
const MAX_VIDEO = 100 * 1024 * 1024;
/** Formats the storage layer accepts as-is. Anything else decodable is re-encoded. */
const NATIVE_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const VIDEO = "video/mp4,video/webm,video/quicktime";
const isVideoUrl = (u: string) => /\.(mp4|webm|mov)$/i.test(u);

/**
 * Re-encode a picked image to webp (max 1600px on the long edge). This is what makes
 * an iPhone HEIC photo or a GIF uploadable even though storage only accepts
 * webp/jpeg/png/avif — and it shrinks huge phone photos before they hit mobile data.
 * Returns null when the browser can't decode the file at all.
 */
async function toWebp(file: File): Promise<{ blob: Blob; type: string } | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement | null>((res) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => res(null);
      i.src = url;
    });
    if (!img) return null;
    const long = Math.max(img.naturalWidth, img.naturalHeight);
    const k = long > 1600 ? 1600 / long : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * k);
    canvas.height = Math.round(img.naturalHeight * k);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.9));
    return blob ? { blob, type: "image/webp" } : null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Multi-image gallery uploader (≤8). Each image: presign → PUT to R2 → append URL. */
export function GalleryUpload({
  value,
  onChange,
  prefix = "gigs",
  label,
  video = false,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  prefix?: "gigs" | "portfolio" | "deliveries" | "requirements" | "messages";
  label?: string;
  video?: boolean;
}) {
  const t = useTranslations("Gig");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Accept every image the browser can decode (HEIC, GIF…) — non-native ones are
  // re-encoded to webp below. Videos stay in their container, so they stay explicit.
  const accept = video ? `image/*,${VIDEO}` : "image/*";

  async function pick(file: File) {
    setError(null);
    const isVid = VIDEO.split(",").includes(file.type);
    if (!isVid && !file.type.startsWith("image/")) return setError(t("mediaType"));
    if (file.size > (isVid ? MAX_VIDEO : MAX_IMAGE)) return setError(t("mediaSize"));
    if (value.length >= MAX) return;
    setBusy(true);
    try {
      // Videos upload as-is; images are normalized to webp (also shrinks phone photos).
      let body: Blob = file;
      let contentType = file.type;
      if (!isVid) {
        const norm = NATIVE_IMAGE.includes(file.type) && file.size <= 2 * 1024 * 1024 ? null : await toWebp(file);
        if (norm) {
          body = norm.blob;
          contentType = norm.type;
        } else if (!NATIVE_IMAGE.includes(file.type)) {
          // Undecodable and not a format storage takes — say so instead of a 4xx later.
          return setError(t("mediaType"));
        }
      }
      const r = await fetch("/api/media/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, contentType, size: body.size }),
      });
      const j = await r.json();
      if (!j.ok) return setError(j.error?.message ?? t("mediaError"));
      const put = await fetch(j.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body,
      });
      if (!put.ok) return setError(t("mediaError"));
      onChange([...value, j.data.publicUrl]);
    } catch {
      setError(t("mediaError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label ?? t("gallery")}</span>
      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div key={url} className="relative h-20 w-28 overflow-hidden rounded-lg border border-[hsl(var(--border))]">
            {url.startsWith("r2-private:") ? (
              // Private deliverable: no public URL to render — show a file chip.
              <div className="flex h-full w-full items-center justify-center bg-[hsl(var(--muted))] text-lg">📎</div>
            ) : isVideoUrl(url) ? (
              <div className="flex h-full w-full items-center justify-center bg-[hsl(var(--muted))] text-lg">▶</div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="h-full w-full object-cover" />
            )}
            <button
              type="button"
              aria-label={t("removeImage")}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute right-1 top-1 rounded bg-black/60 px-1 text-xs leading-none text-white"
            >
              ×
            </button>
          </div>
        ))}
        {value.length < MAX && (
          <button
            type="button"
            aria-label={label || t("addImage")}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex h-20 w-28 items-center justify-center rounded-lg border border-dashed border-[hsl(var(--border))] text-lg text-[hsl(var(--muted-foreground))]"
          >
            {busy ? "…" : "+"}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />
      {error && <p role="alert" className="text-sm text-[hsl(var(--danger))]">{error}</p>}
    </div>
  );
}
