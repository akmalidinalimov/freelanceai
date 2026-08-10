"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { prepareImage } from "@/lib/image-normalize";

interface Item {
  id: string;
  mediaUrl: string;
  mediaType: string; // "image" | "video"
  caption: string | null;
}

// Portfolio takes ANY image the browser can decode (re-encoded to webp before upload)
// and the common video containers INCLUDING .mov, which is what iPhones record.
const VIDEO = ["video/mp4", "video/webm", "video/quicktime"];
const ACCEPT = "image/*,video/*";
const MAX_IMAGE = 12 * 1024 * 1024; // pre-normalize (phone photos are big; we re-encode)
const MAX_VIDEO = 100 * 1024 * 1024; // 100 MB

/** Seller portfolio manager: upload images or short videos (presign → R2 → persist) and remove them. */
export function PortfolioEditor({ items }: { items: Item[] }) {
  const t = useTranslations("Profile");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(file: File) {
    setError(null);
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isImage && !isVideo) return setError(t("portfolioType"));
    if (isVideo && !VIDEO.includes(file.type)) return setError(t("portfolioVideoFormat"));
    if (file.size > (isVideo ? MAX_VIDEO : MAX_IMAGE)) return setError(t("portfolioSize"));
    setBusy(true);
    try {
      // Videos upload as-is; images are re-encoded to webp so HEIC/GIF/etc. all work.
      let body: Blob = file;
      let contentType = file.type;
      if (isImage) {
        const prepared = await prepareImage(file);
        if (!prepared) return setError(t("portfolioType"));
        body = prepared.blob;
        contentType = prepared.contentType;
      }
      const pre = await fetch("/api/media/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: "portfolio", contentType, size: body.size }),
      });
      const pj = await pre.json();
      if (!pj.ok) return setError(pj.error?.message ?? t("portfolioError"));
      const put = await fetch(pj.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body,
      });
      if (!put.ok) return setError(t("portfolioError"));
      const save = await fetch("/api/me/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrl: pj.data.publicUrl, mediaType: isVideo ? "video" : "image" }),
      });
      if (!(await save.json()).ok) return setError(t("portfolioError"));
      router.refresh();
    } catch {
      setError(t("portfolioError"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch("/api/me/portfolio", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t("portfolio")}</span>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <div key={it.id} className="relative h-24 w-32 overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]">
            {it.mediaType === "video" ? (
              <>
                <video src={it.mediaUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 grid place-items-center text-white [text-shadow:0_1px_3px_rgba(0,0,0,.6)]"
                >
                  ▶
                </span>
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.mediaUrl} alt={it.caption ?? ""} className="h-full w-full object-cover" />
            )}
            <button
              type="button"
              onClick={() => remove(it.id)}
              disabled={busy}
              aria-label={t("portfolioRemove")}
              className="absolute right-1 top-1 rounded bg-black/60 px-1 text-xs leading-none text-white"
            >
              ×
            </button>
          </div>
        ))}
        {items.length < 12 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-label={t("portfolioAdd")}
            className="flex h-24 w-32 items-center justify-center rounded-lg border border-dashed border-[hsl(var(--border))] text-2xl text-[hsl(var(--muted-foreground))]"
          >
            {busy ? "…" : "+"}
          </button>
        )}
      </div>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{t("portfolioUploadHint")}</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) add(f);
          e.target.value = "";
        }}
      />
      {error && <p role="alert" className="text-sm text-[hsl(var(--danger))]">{error}</p>}
    </div>
  );
}
