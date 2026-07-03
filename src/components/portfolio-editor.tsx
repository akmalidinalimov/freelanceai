"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Item {
  id: string;
  mediaUrl: string;
  caption: string | null;
}

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX = 8 * 1024 * 1024;

/** Seller portfolio manager: upload images (presign → R2 → persist) and remove them. */
export function PortfolioEditor({ items }: { items: Item[] }) {
  const t = useTranslations("Profile");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(file: File) {
    setError(null);
    if (!ACCEPT.includes(file.type)) return setError(t("portfolioType"));
    if (file.size > MAX) return setError(t("portfolioSize"));
    setBusy(true);
    try {
      const pre = await fetch("/api/media/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: "portfolio", contentType: file.type, size: file.size }),
      });
      const pj = await pre.json();
      if (!pj.ok) return setError(t("portfolioError"));
      const put = await fetch(pj.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) return setError(t("portfolioError"));
      const save = await fetch("/api/me/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrl: pj.data.publicUrl, mediaType: "image" }),
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
          <div key={it.id} className="relative h-24 w-32 overflow-hidden rounded-lg border border-[hsl(var(--border))]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.mediaUrl} alt={it.caption ?? ""} className="h-full w-full object-cover" />
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
            className="flex h-24 w-32 items-center justify-center rounded-lg border border-dashed border-[hsl(var(--border))] text-2xl text-[hsl(var(--muted-foreground))]"
          >
            {busy ? "…" : "+"}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) add(f);
          e.target.value = "";
        }}
      />
      {error && <p className="text-sm text-[hsl(var(--danger))]">{error}</p>}
    </div>
  );
}
