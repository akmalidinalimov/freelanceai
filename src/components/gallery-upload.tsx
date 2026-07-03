"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

const MAX = 8;
const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const VIDEO = "video/mp4,video/webm";
const isVideoUrl = (u: string) => /\.(mp4|webm)$/i.test(u);

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
  const accept = video ? `${ACCEPT},${VIDEO}` : ACCEPT;

  async function pick(file: File) {
    setError(null);
    if (!accept.split(",").includes(file.type)) return setError(t("mediaType"));
    const isVid = VIDEO.split(",").includes(file.type);
    if (file.size > (isVid ? MAX_VIDEO : MAX_IMAGE)) return setError(t("mediaSize"));
    if (value.length >= MAX) return;
    setBusy(true);
    try {
      const r = await fetch("/api/media/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, contentType: file.type, size: file.size }),
      });
      const j = await r.json();
      if (!j.ok) return setError(t("mediaError"));
      const put = await fetch(j.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
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
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}
