"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE = 8 * 1024 * 1024; // 8 MB
const MAX_VIDEO = 40 * 1024 * 1024; // 40 MB — keep the showreel light for mobile data

type Banner = { url: string; type: string; poster: string | null };

/** Upload a presigned R2 object; returns its public URL. */
async function upload(prefix: string, file: Blob, contentType: string): Promise<string> {
  const pre = await fetch("/api/media/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, contentType, size: file.size }),
  });
  const pj = await pre.json();
  if (!pj.ok) throw new Error("presign");
  const put = await fetch(pj.data.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
  if (!put.ok) throw new Error("put");
  return pj.data.publicUrl as string;
}

/** Grab the first frame of a video File as a webp poster (all client-side, pre-upload). */
async function posterFrame(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    await new Promise<void>((res, rej) => {
      v.onloadeddata = () => res();
      v.onerror = () => rej(new Error("decode"));
    });
    v.currentTime = Math.min(0.1, (v.duration || 1) - 0.01);
    await new Promise<void>((res) => {
      v.onseeked = () => res();
    });
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 1280;
    canvas.height = v.videoHeight || 720;
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("poster"))), "image/webp", 0.8)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function BannerUploader({ initial }: { initial: Banner | null }) {
  const t = useTranslations("Profile");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [banner, setBanner] = useState<Banner | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: Banner | null) {
    const r = await fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bannerUrl: next?.url ?? null,
        ...(next ? { bannerType: next.type } : {}),
        bannerPosterUrl: next?.poster ?? null,
      }),
    });
    if (!(await r.json()).ok) throw new Error("save");
  }

  async function pick(file: File) {
    setError(null);
    const isVideo = VIDEO_TYPES.includes(file.type);
    const isImage = IMAGE_TYPES.includes(file.type);
    if (!isVideo && !isImage) return setError(t("bannerType"));
    if (file.size > (isVideo ? MAX_VIDEO : MAX_IMAGE)) return setError(t("bannerSize"));
    setBusy(true);
    try {
      let next: Banner;
      if (isVideo) {
        const [videoUrl, poster] = await Promise.all([
          upload("portfolio", file, file.type),
          posterFrame(file).then((b) => upload("portfolio", b, "image/webp")),
        ]);
        next = { url: videoUrl, type: "video", poster };
      } else {
        next = { url: await upload("portfolio", file, file.type), type: "image", poster: null };
      }
      await save(next);
      setBanner(next);
    } catch {
      setError(t("bannerError"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await save(null);
      setBanner(null);
    } catch {
      setError(t("bannerError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-4">
      <div className="mb-1 text-sm font-semibold">{t("banner")}</div>
      <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">{t("bannerHint")}</p>

      {banner && (
        <div className="mb-3 aspect-[5/2] w-full overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]">
          {banner.type === "video" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={banner.url} poster={banner.poster ?? undefined} muted loop playsInline autoPlay className="h-full w-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={banner.url} alt="" className="h-full w-full object-cover" />
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(",")}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
        />
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? "…" : banner ? t("bannerReplace") : t("bannerAdd")}
        </Button>
        {banner && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--danger))]"
          >
            {t("bannerRemove")}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-[hsl(var(--danger))]">{error}</p>}
    </div>
  );
}
