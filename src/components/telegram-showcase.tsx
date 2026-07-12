"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";

/**
 * A creator's Telegram-channel portfolio: each saved post link (t.me/<channel>/<id>)
 * is rendered as a live Telegram post via Telegram's own embed iframe
 * (`https://t.me/<channel>/<id>?embed=1`). This shows the real image / video / album +
 * caption exactly as posted — the standard "my Telegram channel is my portfolio" case.
 *
 * We embed the iframe DIRECTLY (no telegram-widget.js third-party script): the only thing
 * that script adds is auto-height, which we reproduce by listening for the post's own
 * `postMessage({event:"resize",height})`. Cleaner CSP surface (frame-src only) and no
 * external JS. Renders nothing when the creator has no posts.
 */
export function TelegramShowcase({ posts, channel }: { posts: string[]; channel: string | null }) {
  const tt = useTranslations("Telegram");
  const [heights, setHeights] = useState<Record<number, number>>({});
  const frames = useRef<(HTMLIFrameElement | null)[]>([]);

  useEffect(() => {
    // Telegram post iframes post {event:"resize", height} to the parent as they load.
    // Match by contentWindow so each frame sizes itself; ignore everything else.
    function onMessage(e: MessageEvent) {
      if (e.origin !== "https://t.me") return;
      let data: unknown = e.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== "object") return;
      const d = data as { event?: string; height?: number };
      // Clamp to a sane range — even a trusted frame shouldn't drive NaN/0/huge heights.
      if (d.event !== "resize" || !Number.isFinite(d.height) || d.height! <= 0 || d.height! > 4000) return;
      const idx = frames.current.findIndex((f) => f && f.contentWindow === e.source);
      if (idx >= 0) setHeights((h) => (h[idx] === d.height ? h : { ...h, [idx]: d.height! }));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!posts.length) return null;

  const channelUrl = channel ? `https://t.me/${channel}` : null;

  return (
    <section aria-label={tt("portfolio")} className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <Send className="h-4 w-4 text-[hsl(199_89%_48%)]" aria-hidden />
        <span className="text-sm font-semibold">{tt("portfolio")}</span>
        {channelUrl && (
          <a
            href={channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] px-3 py-1 text-xs font-semibold hover:border-[hsl(var(--primary))]"
          >
            {tt("followChannel")} · @{channel}
          </a>
        )}
      </div>

      {/* Masonry-ish responsive columns so tall video posts and short image posts
          pack tightly without a rigid grid. */}
      <div className="[column-gap:0.75rem] sm:columns-2 lg:columns-3">
        {posts.map((url, i) => {
          const embed = `${url}?embed=1&userpic=true&dark=0`;
          return (
            <div
              key={url}
              className="mb-3 break-inside-avoid overflow-hidden rounded-[var(--radius-md)] border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
            >
              <iframe
                ref={(el) => {
                  frames.current[i] = el;
                }}
                src={embed}
                title={tt("postTitle", { n: i + 1 })}
                loading="lazy"
                scrolling="no"
                className="w-full"
                style={{ height: heights[i] ?? 320, border: "0", display: "block" }}
              />
            </div>
          );
        })}
      </div>

      {/* No-JS / blocked-iframe fallback: the links still reach the real posts. */}
      <noscript>
        <ul className="mt-2 space-y-1 text-sm">
          {posts.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--primary-ink))] underline">
                {url.replace(/^https:\/\//, "")}
              </a>
            </li>
          ))}
        </ul>
      </noscript>
    </section>
  );
}
