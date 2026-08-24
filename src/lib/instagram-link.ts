/**
 * Instagram permalink helpers for the NO-API manual portfolio (mirror of telegram-link.ts).
 * A seller pastes a post/reel URL; we canonicalize it and derive Instagram's own embeddable
 * iframe URL (`.../embed`) — the standard way to show a real IG post WITHOUT the Graph API or
 * Meta App Review. Rejects anything that isn't a public instagram.com post/reel/tv link.
 */

/** Canonicalize an Instagram post/reel/tv URL, or null if it isn't one. */
export function normalizeInstagramPost(input: string): string | null {
  const m = input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[?#].*$/, "")
    .match(/^instagram\.com\/(?:[A-Za-z0-9._]+\/)?(p|reel|tv)\/([A-Za-z0-9_-]{5,20})\/?$/i);
  return m ? `https://www.instagram.com/${m[1].toLowerCase()}/${m[2]}/` : null;
}

/** Canonicalize an Instagram handle (from a URL or a bare/@ handle), or null. */
export function normalizeInstagramHandle(input: string): string | null {
  const h = input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\.instagram\.com\//i, "")
    .replace(/^instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "")
    .replace(/[^A-Za-z0-9._]/g, "")
    .slice(0, 30);
  return h || null;
}

/** Instagram's own embeddable iframe URL for a canonical post URL (no script/API needed). */
export function instagramEmbedUrl(canonicalPostUrl: string): string {
  return `${canonicalPostUrl.replace(/\/$/, "")}/embed`;
}
