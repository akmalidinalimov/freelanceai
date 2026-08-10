"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { ImageCropper } from "@/components/ui/image-cropper";

const MAX = 12 * 1024 * 1024; // 12 MB pre-crop (phone photos are big; we re-encode anyway)
const OUT = 512; // output a square 512px webp — small, consistent, fast on mobile data

/**
 * Avatar picker: pick ANY image the browser can decode → crop it yourself (pan + zoom)
 * → upload as a square 512px webp → save. Because the cropper re-encodes to webp, an
 * iPhone HEIC or a GIF works even though the storage allowlist is webp/jpeg/png/avif.
 * A missing photo still shows the deterministic initials Avatar, so a seller always
 * has an identity.
 */
export function AvatarUpload({
  initialUrl,
  name,
  compact = false,
}: {
  initialUrl?: string | null;
  name?: string | null;
  /** Instagram-style: just the avatar with a camera badge (no buttons/labels beside it). */
  compact?: boolean;
}) {
  const t = useTranslations("Profile");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

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

  /** Called with the cropper's webp output. */
  async function upload(blob: Blob) {
    setBusy(true);
    try {
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

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) {
          setError(null);
          if (f.size > MAX) setError(t("avatarSize"));
          else setCropFile(f);
        }
        e.target.value = "";
      }}
    />
  );
  const cropper = cropFile && (
    <ImageCropper
      file={cropFile}
      aspect={1}
      outWidth={OUT}
      onCancel={() => setCropFile(null)}
      onCropped={(blob) => {
        setCropFile(null);
        upload(blob);
      }}
    />
  );

  // Compact: the avatar IS the button, with a camera badge — the profile-header look.
  if (compact) {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={url ? t("avatarChange") : t("avatarAdd")}
          className="block rounded-full ring-2 ring-[hsl(var(--primary))]/30 disabled:opacity-60"
        >
          <Avatar src={url} name={name} size="xl" />
        </button>
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full border-2 border-[hsl(var(--card))] bg-[hsl(var(--primary))] text-xs text-[hsl(var(--primary-foreground))]"
        >
          {busy ? "…" : "📷"}
        </span>
        {error && (
          <p className="absolute left-1/2 top-full mt-1 w-40 -translate-x-1/2 text-center text-xs text-[hsl(var(--danger))]" role="alert">
            {error}
          </p>
        )}
        {fileInput}
        {cropper}
      </div>
    );
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
        {error && <p role="alert" className="text-sm text-[hsl(var(--danger))]">{error}</p>}
      </div>
      {/* accept="image/*" on purpose: the cropper re-encodes to webp, so HEIC/GIF/BMP
          all work. Anything the browser can't decode gets a clear message in the dialog. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setError(null);
            if (f.size > MAX) setError(t("avatarSize"));
            else setCropFile(f);
          }
          e.target.value = "";
        }}
      />
      {cropFile && (
        <ImageCropper
          file={cropFile}
          aspect={1}
          outWidth={OUT}
          onCancel={() => setCropFile(null)}
          onCropped={(blob) => {
            setCropFile(null);
            upload(blob);
          }}
        />
      )}
    </div>
  );
}
