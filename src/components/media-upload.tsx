"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

const MAX_IMAGE = 8 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

/** Single-image uploader: presign → PUT to R2 → returns the public URL. */
export function MediaUpload({
  value,
  onChange,
}: {
  value?: string;
  onChange: (url: string | undefined) => void;
}) {
  const t = useTranslations("Gig");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    setError(null);
    if (!ACCEPT.split(",").includes(file.type)) {
      setError(t("mediaType"));
      return;
    }
    if (file.size > MAX_IMAGE) {
      setError(t("mediaSize"));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/media/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: "gigs", contentType: file.type, size: file.size }),
      });
      const j = await r.json();
      if (!j.ok) {
        setError(t("mediaError"));
        setBusy(false);
        return;
      }
      const put = await fetch(j.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) {
        setError(t("mediaError"));
        setBusy(false);
        return;
      }
      onChange(j.data.publicUrl);
    } catch {
      setError(t("mediaError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t("cover")}</span>
      <div
        onClick={() => inputRef.current?.click()}
        className="flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 text-sm text-[hsl(var(--muted-foreground))]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : busy ? (
          t("uploading")
        ) : (
          t("addCover")
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="self-start text-xs text-[hsl(var(--danger))] underline"
        >
          {t("removeCover")}
        </button>
      )}
      {error && <p className="text-sm text-[hsl(var(--danger))]">{error}</p>}
    </div>
  );
}
