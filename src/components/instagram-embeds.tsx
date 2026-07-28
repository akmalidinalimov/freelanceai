"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Instagram } from "lucide-react";
import { instagramEmbedUrl } from "@/lib/instagram-link";

/**
 * A creator's Instagram portfolio (NO-API path): each chosen post/reel link is rendered as the
 * real post via Instagram's OWN embed page (`.../p/<code>/embed`) in a direct iframe — no
 * embed.js, no Graph API, no Meta App Review. Instagram posts a {type:"MEASURE",details:{height}}
 * message as the embed loads; we use it for auto-height and fall back to a sane default.
 * Renders nothing when the creator has no posts. Mirrors TelegramShowcase.
 */
export function InstagramEmbeds({ posts, handle }: { posts: string[]; handle: string | null }) {
  const t = useTranslations("Instagram");
  const [heights, setHeights] = useState<Record<number, number>>({});
  const frames = useRef<(HTMLIFrameElement | null)[]>([]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== "https://www.instagram.com") return;
      let data: unknown = e.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== "object") return;
      const d = data as { type?: string; details?: { height?: number } };
      const height = d.details?.height;
      if (d.type !== "MEASURE" || !Number.isFinite(height) || height! <= 0 || height! > 4000) return;
      const idx = frames.current.findIndex((f) => f && f.contentWindow === e.source);
      if (idx >= 0) setHeights((h) => (h[idx] === height ? h : { ...h, [idx]: height! }));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!posts.length) return null;

  const profileUrl = handle ? `https://www.instagram.com/${handle}` : null;

  return (
    <section aria-label={t("portfolio")} className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <Instagram className="h-4 w-4 text-[hsl(322_80%_55%)]" aria-hidden />
        <span className="text-sm font-semibold">{t("portfolio")}</span>
        {profileUrl && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] px-3 py-1 text-xs font-semibold hover:border-[hsl(var(--primary))]"
          >
            {t("followProfile")} · @{handle}
          </a>
        )}
      </div>

      <div className="[column-gap:0.75rem] sm:columns-2 lg:columns-3">
        {posts.map((url, i) => (
          <div
            key={url}
            className="mb-3 break-inside-avoid overflow-hidden rounded-[var(--radius-md)] border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
          >
            <iframe
              ref={(el) => {
                frames.current[i] = el;
              }}
              src={instagramEmbedUrl(url)}
              title={t("postTitle", { n: i + 1 })}
              loading="lazy"
              scrolling="no"
              className="w-full"
              style={{ height: heights[i] ?? 520, border: "0", display: "block" }}
            />
          </div>
        ))}
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
