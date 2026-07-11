"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const field = "w-full rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 py-2 text-sm";

/**
 * Telegram-channel portfolio source: a channel handle (auto-populates from the public
 * channel's latest posts) + optional pinned post links. Saves on its own to
 * PATCH /api/me/profile — one of the three portfolio sources on the hub.
 */
export function TelegramPortfolioForm({
  initial,
  username,
}: {
  initial: { channel: string; posts: string[] };
  username?: string | null;
}) {
  const tt = useTranslations("Telegram");
  const t = useTranslations("Profile");
  const [channel, setChannel] = useState(initial.channel);
  const [posts, setPosts] = useState<string[]>(initial.posts.length ? [...initial.posts, ""] : [""]);
  const [busy, setBusy] = useState(false);
  // QA fix: "saved but nothing shows up, no feedback either way" — the result state now
  // spells out what happened and what will (or won't) display on the public profile.
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
        body: JSON.stringify({ telegramChannel: channel.trim(), telegramPosts: cleanPosts }),
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
        <span className="text-sm font-medium">{tt("channel")}</span>
        <input
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          placeholder={tt("channelHint")}
          className={field}
          inputMode="text"
          autoCapitalize="none"
        />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{tt("posts")}</span>
        {posts.map((p, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={p}
              onChange={(e) => setPost(i, e.target.value)}
              placeholder="https://t.me/kanal/123"
              className={field}
              inputMode="url"
              autoCapitalize="none"
            />
            {(posts.length > 1 || p.trim()) && (
              <button
                type="button"
                onClick={() => removePost(i)}
                aria-label={tt("removePost")}
                className="shrink-0 rounded-md border border-[hsl(var(--border))] px-3 text-sm text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--danger))] hover:text-[hsl(var(--danger))]"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{tt("postsHint")}</p>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? "…" : t("save")}
        </Button>
      </div>
      {result === "saved" && (
        <div className="rounded-lg border border-[hsl(var(--success))]/40 bg-[hsl(var(--success-soft))] px-3 py-2 text-sm text-[hsl(var(--success))]">
          ✓ {tt("savedDetail")}{" "}
          {username && (
            <a href={`/creators/${username}`} target="_blank" rel="noreferrer" className="font-semibold underline">
              {tt("viewProfile")}
            </a>
          )}
        </div>
      )}
      {result === "savedNoPosts" && (
        <div className="rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning-soft))] px-3 py-2 text-sm text-[hsl(var(--warning-foreground))]">
          {tt("savedNoPosts")}{" "}
          {username && (
            <a href={`/creators/${username}`} target="_blank" rel="noreferrer" className="font-semibold underline">
              {tt("viewProfile")}
            </a>
          )}
        </div>
      )}
      {result === "error" && (
        <div className="rounded-lg border border-[hsl(var(--danger))]/40 bg-[hsl(var(--danger-soft))] px-3 py-2 text-sm text-[hsl(var(--danger))]">
          {tt("saveError")}
        </div>
      )}
    </div>
  );
}
