import "server-only";
import { unstable_cache } from "next/cache";

const HANDLE_RE = /^[A-Za-z0-9_]{4,32}$/;
const MAX_POSTS = 16;

/**
 * Fetch a PUBLIC Telegram channel's recent post links by reading its public web
 * preview (`https://t.me/s/<handle>`) and extracting the message ids. Lets a creator
 * auto-populate their Masonry portfolio from just a channel handle — no pasting links.
 *
 * SSRF-safe: the host is the fixed literal `t.me`, and `handle` is validated to
 * `[A-Za-z0-9_]{4,32}` so it can't inject a path/host. Returns [] on any failure
 * (private channel, network error, markup change) so the caller falls back cleanly.
 * Only PUBLIC channels expose this preview; private ones simply yield [].
 */
async function fetchChannelPostsUncached(handle: string): Promise<string[]> {
  if (!HANDLE_RE.test(handle)) return [];
  try {
    const res = await fetch(`https://t.me/s/${handle}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GigoraBot/1.0; +https://gigora.ai)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    // Public preview marks each post with data-post="<handle>/<id>". Match only THIS
    // handle's own posts (ignore quoted/forwarded posts from other channels).
    const re = new RegExp(`data-post="${handle}/(\\d{1,15})"`, "g");
    const ids: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) ids.push(Number(m[1]));
    // The preview lists oldest→newest; take the newest MAX_POSTS, newest first.
    const latest = [...new Set(ids)].sort((a, b) => a - b).slice(-MAX_POSTS).reverse();
    return latest.map((id) => `https://t.me/${handle}/${id}`);
  } catch {
    return [];
  }
}

/** Cached (1h) per handle — never hammers Telegram, and profile SSR stays fast. */
export const fetchChannelPosts = unstable_cache(fetchChannelPostsUncached, ["tg-channel-posts"], {
  revalidate: 3600,
});
