"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX = 8 * 1024 * 1024; // 8 MB (pre-crop)
const OUT = 512; // output a square 512px webp — small, consistent, fast on mobile data

/** Center-crop a picked image to a square `OUT`×`OUT` webp blob (client-side). */
async function toSquareWebp(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("decode"));
      i.src = url;
    });
    const edge = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - edge) / 2;
    const sy = (img.naturalHeight - edge) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    canvas.getContext("2d")!.drawImage(img, sx, sy, edge, edge, 0, 0, OUT, OUT);
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/webp", 0.9)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Avatar picker for the profile: pick → auto center-crop to a square webp → upload → save.
 * The cropped blob's OWN size is sent to presign and PUT (consistent), and any missing photo
 * shows the deterministic initials Avatar, so a seller always has an identity.
 */
export function AvatarUpload({ initialUrl, name }: { initialUrl?: string | null; name?: string | null }) {
  const t = useTranslations("Profile");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(photoUrl: string | null) {
    const r = await fetch("/api/me/avatar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoUrl }),
    });
    if (!r.ok) throw new Error("save");
    setUrl(photoUrl);
    router.refresh();
  }

  async function pick(file: File) {
    setError(null);
    if (!ACCEPT.includes(file.type)) return setError(t("avatarType"));
    if (file.size > MAX) return setError(t("avatarSize"));
    setBusy(true);
    try {
      const blob = await toSquareWebp(file);
      const pre = await fetch("/api/media/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: "avatars", contentType: "image/webp", size: blob.size }),
      });
      const pj = await pre.json();
      if (!pj.ok) return setError(pj.error?.message ?? t("avatarError"));
      const put = await fetch(pj.data.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/webp" }, body: blob });
      if (!put.ok) return setError(t("avatarError"));
      await save(pj.data.publicUrl as string);
    } catch {
      setError(t("avatarError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar src={url} name={name} size="xl" />
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {busy ? t("avatarUploading") : url ? t("avatarChange") : t("avatarAdd")}
          </button>
          {url && (
            <button
              type="button"
              onClick={() => save(null).catch(() => setError(t("avatarError")))}
              disabled={busy}
              className="rounded-md px-3 py-1.5 text-sm text-[hsl(var(--danger))] disabled:opacity-50"
            >
              {t("avatarRemove")}
            </button>
          )}
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{t("avatarHint")}</p>
        {error && <p className="text-sm text-[hsl(var(--danger))]" role="alert">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
