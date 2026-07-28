"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImageCropper } from "@/components/ui/image-cropper";

const VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE = 8 * 1024 * 1024; // 8 MB
const MAX_VIDEO = 40 * 1024 * 1024; // 40 MB — keep the showreel light for mobile data
const MIN_EDGE = 640; // reject tiny covers that look soft in the 16:9 frame

export interface CoverValue {
  url: string;
  type: "image" | "video";
  poster?: string;
  w?: number;
  h?: number;
}

/** Presign an R2 object and PUT the blob; returns the public URL. */
async function upload(file: Blob, contentType: string): Promise<string> {
  const pre = await fetch("/api/media/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "gigs", contentType, size: file.size }),
  });
  const pj = await pre.json();
  if (!pj.ok) throw new Error("presign");
  const put = await fetch(pj.data.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
  if (!put.ok) throw new Error("put");
  return pj.data.publicUrl as string;
}

/** Read an image's natural dimensions client-side (0×0 on failure). */
function imageDims(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ w: 0, h: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

/** Grab a video's first frame as a webp poster (client-side, pre-upload). */
async function posterFrame(file: File): Promise<{ blob: Blob; w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
    const withTimeout = <T,>(p: Promise<T>, ms: number) =>
      Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
    await withTimeout(new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error("decode")); }), 8000);
    v.currentTime = Math.min(0.1, (v.duration || 1) - 0.01);
    await withTimeout(new Promise<void>((res) => (v.onseeked = () => res())), 4000);
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 1280;
    canvas.height = v.videoHeight || 720;
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("poster"))), "image/webp", 0.82));
    return { blob, w: canvas.width, h: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Gig cover uploader: a 16:9 image OR short horizontal video. Reports the result up to
 *  the form (does not persist itself). Video covers also capture a first-frame poster. */
export function CoverUpload({
  value,
  onChange,
  genTitle,
  genCategoryId,
  genPriceUzs,
  locale,
}: {
  value?: CoverValue;
  onChange: (v: CoverValue | undefined) => void;
  /** Context for "generate a cover for me" — the branded 16:9 template render. */
  genTitle?: string;
  genCategoryId?: string;
  genPriceUzs?: number;
  locale?: string;
}) {
  const t = useTranslations("Gig");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  /** Upload a 16:9 crop produced by the cropper. */
  async function uploadCropped(blob: Blob) {
    setBusy(true);
    try {
      const url = await upload(blob, "image/webp");
      onChange({ url, type: "image", w: 1600, h: 900 });
    } catch {
      setError(t("mediaError"));
    } finally {
      setBusy(false);
    }
  }

  /** Branded template cover (free, server-rendered) for sellers with no image ready. */
  async function generate() {
    setError(null);
    if (!genTitle || genTitle.trim().length < 3) return setError(t("coverGenNeedTitle"));
    setBusy(true);
    try {
      const r = await fetch("/api/gigs/cover-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: genTitle.trim(),
          ...(genCategoryId ? { categoryId: genCategoryId } : {}),
          ...(genPriceUzs ? { priceUzs: genPriceUzs } : {}),
          locale: locale === "ru" || locale === "en" ? locale : "uz",
        }),
      });
      const j = await r.json();
      if (!j.ok) return setError(j.error?.message ?? t("mediaError"));
      onChange({ url: j.data.url, type: "image", w: 1600, h: 900 });
    } catch {
      setError(t("mediaError"));
    } finally {
      setBusy(false);
    }
  }

  async function pick(file: File) {
    setError(null);
    const isVideo = VIDEO_TYPES.includes(file.type);
    const isImage = file.type.startsWith("image/"); // any decodable image; cropper re-encodes
    if (!isVideo && !isImage) return setError(t("coverAcceptType"));
    if (file.size > (isVideo ? MAX_VIDEO : MAX_IMAGE)) return setError(isVideo ? t("coverVideoSize") : t("mediaSize"));

    if (isImage) {
      // Images go through the 16:9 cropper: the seller frames their own cover instead of
      // discovering later that the card cropped their subject out.
      const { w, h } = await imageDims(file);
      if (w && h && Math.min(w, h) < MIN_EDGE) return setError(t("mediaTooSmall", { min: MIN_EDGE }));
      setCropFile(file);
      return;
    }

    // video
    setBusy(true);
    try {
      const pf = await posterFrame(file).catch(() => null);
      const [videoUrl, poster] = await Promise.all([
        upload(file, file.type),
        pf ? upload(pf.blob, "image/webp") : Promise.resolve<string | undefined>(undefined),
      ]);
      onChange({ url: videoUrl, type: "video", poster, w: pf?.w, h: pf?.h });
    } catch { setError(t("coverVideoError")); } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center justify-between text-sm font-medium">
        {t("cover")}
        <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">{t("coverBannerHint")}</span>
      </span>
      <div
        role="button"
        tabIndex={0}
        aria-label={t("addCover")}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { if (e.key === " ") e.preventDefault(); inputRef.current?.click(); } }}
        className="relative flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 text-sm text-[hsl(var(--muted-foreground))]"
      >
        {value?.type === "video" ? (
          <video src={value.url} poster={value.poster} muted loop playsInline autoPlay className="h-full w-full object-cover" />
        ) : value?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.url} alt="" className="h-full w-full object-cover" />
        ) : busy ? (
          t("uploading")
        ) : (
          t("addCover")
        )}
        {value?.type === "video" && (
          <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">▶ {t("coverVideoBadge")}</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={["image/*", ...VIDEO_TYPES].join(",")}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }}
      />
      {cropFile && (
        <ImageCropper
          file={cropFile}
          aspect={16 / 9}
          outWidth={1600}
          onCancel={() => setCropFile(null)}
          onCropped={(blob) => {
            setCropFile(null);
            uploadCropped(blob);
          }}
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        {!value?.url && (
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="rounded-md border border-[hsl(var(--primary))]/50 px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary-ink))] disabled:opacity-50"
          >
            {busy ? t("uploading") : `✨ ${t("coverGenerate")}`}
          </button>
        )}
        {!value?.url && <span className="text-xs text-[hsl(var(--muted-foreground))]">{t("coverGenHint")}</span>}
        {value?.url && (
          <button type="button" onClick={() => onChange(undefined)} className="text-xs text-[hsl(var(--danger))] underline">
            {t("removeCover")}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-[hsl(var(--danger))]">{error}</p>}
    </div>
  );
}
