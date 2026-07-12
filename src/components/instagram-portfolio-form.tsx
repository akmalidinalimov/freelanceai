"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const field = "w-full rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 py-2 text-sm";

/**
 * Instagram portfolio source (NO-API): an @handle (for a "follow" link) + public post/reel
 * links the seller picks to showcase — embedded on their profile via Instagram's own /embed.
 * Works without Meta App Review. Saves on its own to PATCH /api/me/profile. Mirrors the
 * Telegram portfolio form.
 */
export function InstagramPortfolioForm({
  initial,
  username,
}: {
  initial: { handle: string; posts: string[] };
  username?: string | null;
}) {
  const t = useTranslations("Instagram");
  const tp = useTranslations("Profile");
  const [handle, setHandle] = useState(initial.handle);
  const [posts, setPosts] = useState<string[]>(initial.posts.length ? [...initial.posts, ""] : [""]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"idle" | "saved" | "savedNoPosts" | "error">("idle");

  const setPost = (i: number, v: string) =>
    setPosts((prev) => {
      const next = [...prev];
      next[i] = v;
      if (i === next.length - 1 && v.trim()) next.push("");
      return next;
    });
  const removePost = (i: number) =>
    setPosts((prev) => {
      const next = prev.filter((_, j) => j !== i);
      return next.length ? next : [""];
    });

  async function save() {
    setBusy(true);
    setResult("idle");
    const cleanPosts = posts.map((p) => p.trim()).filter(Boolean);
    try {
      const r = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramUsername: handle.trim(), instagramPosts: cleanPosts }),
      });
      const ok = (await r.json()).ok;
      setResult(ok ? (cleanPosts.length > 0 ? "saved" : "savedNoPosts") : "error");
    } catch {
      setResult("error");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("handle")}</span>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder={t("handleHint")}
          className={field}
          inputMode="text"
          autoCapitalize="none"
        />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("posts")}</span>
        {posts.map((p, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={p}
              onChange={(e) => setPost(i, e.target.value)}
              placeholder="https://www.instagram.com/p/XXXXXXX/"
              className={field}
              inputMode="url"
              autoCapitalize="none"
            />
            {(posts.length > 1 || p.trim()) && (
              <button
                type="button"
                onClick={() => removePost(i)}
                aria-label={t("removePost")}
                className="shrink-0 rounded-md border border-[hsl(var(--border))] px-3 text-sm text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--danger))] hover:text-[hsl(var(--danger))]"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{t("postsHint")}</p>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? "…" : tp("save")}
        </Button>
      </div>
      {result === "saved" && (
        <div className="rounded-lg border border-[hsl(var(--success))]/40 bg-[hsl(var(--success-soft))] px-3 py-2 text-sm text-[hsl(var(--success))]">
          ✓ {t("savedDetail")}{" "}
          {username && (
            <a href={`/creators/${username}`} target="_blank" rel="noreferrer" className="font-semibold underline">
              {t("viewProfile")}
            </a>
          )}
        </div>
      )}
      {result === "savedNoPosts" && (
        <div className="rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning-soft))] px-3 py-2 text-sm text-[hsl(var(--warning-foreground))]">
          {t("savedNoPosts")}
        </div>
      )}
      {result === "error" && (
        <div className="rounded-lg border border-[hsl(var(--danger))]/40 bg-[hsl(var(--danger-soft))] px-3 py-2 text-sm text-[hsl(var(--danger))]">
          {t("saveError")}
        </div>
      )}
    </div>
  );
}
