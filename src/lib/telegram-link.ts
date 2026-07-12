/**
 * Pure Telegram-link normalizers for the channel-portfolio feature. No server deps
 * (safe to unit-test and import anywhere). Security intent: only PUBLIC channel post
 * links are embeddable, so private/invite links (t.me/+hash, /c/…) and non-t.me hosts
 * are rejected — we never render a broken or access-gated iframe.
 */

const TG_HANDLE_RE = /^[A-Za-z0-9_]{4,32}$/;

/** A bare Telegram channel handle from any of: "@name", "name", "t.me/name", "https://t.me/name". */
export function normalizeTelegramChannel(input: string): string | null {
  const h = input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^t\.me\//i, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "") // drop any trailing path
    .trim();
  return TG_HANDLE_RE.test(h) ? h : null;
}

/** Canonicalize a public Telegram POST link to `https://t.me/<channel>/<id>`, or null. */
export function normalizeTelegramPost(input: string): string | null {
  const m = input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/[?#].*$/, "")
    .match(/^t\.me\/([A-Za-z0-9_]{4,32})\/(\d{1,15})$/i);
  return m ? `https://t.me/${m[1]}/${m[2]}` : null;
}
