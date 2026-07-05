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
export function TelegramPortfolioForm({ initial }: { initial: { channel: string; posts: string[] } }) {
  const tt = useTranslations("Telegram");
  const t = useTranslations("Profile");
  const [channel, setChannel] = useState(initial.channel);
  const [posts, setPosts] = useState<string[]>(initial.posts.length ? [...initial.posts, ""] : [""]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

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
    setSaved(false);
    const r = await fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegramChannel: channel.trim(),
        telegramPosts: posts.map((p) => p.trim()).filter(Boolean),
      }),
    });
    setBusy(false);
    if ((await r.json()).ok) setSaved(true);
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
        {saved && <span className="text-sm text-[hsl(var(--success))]">{t("saved")}</span>}
      </div>
    </div>
  );
}
