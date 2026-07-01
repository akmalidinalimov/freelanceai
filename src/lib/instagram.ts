import "server-only";
import crypto from "node:crypto";

/**
 * Instagram API with Instagram Login (Business Login) — the post-Basic-Display API.
 * Creators connect a Business/Creator IG account; we read their media (scope
 * instagram_business_basic) and re-host it to R2 (Graph CDN URLs expire).
 *
 * GO-LIVE GATE: works only for app-role testers until Meta App Review approves the
 * scope — see docs/instagram-go-live.md. Feature is disabled unless env is set:
 * INSTAGRAM_APP_ID + INSTAGRAM_APP_SECRET (+ APP_ORIGIN for the redirect URI).
 */

const OAUTH_BASE = "https://www.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const GRAPH = "https://graph.instagram.com";

export function instagramConfigured(): boolean {
  return Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
}

export function redirectUri(): string {
  const origin = (process.env.APP_ORIGIN ?? "").replace(/\/$/, "");
  return `${origin}/api/instagram/callback`;
}

// --- state param: HMAC-signed, session-bound, 10-min expiry (CSRF defense) ---

function stateSecret(): string {
  return process.env.SESSION_SECRET ?? "";
}

export function signState(userId: string): string {
  const payload = `${userId}.${Date.now() + 10 * 60 * 1000}`;
  const mac = crypto.createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

export function verifyState(state: string): string | null {
  const [b64, mac] = state.split(".");
  if (!b64 || !mac) return null;
  const payload = Buffer.from(b64, "base64url").toString();
  const expected = crypto.createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected)))
    return null;
  const [userId, expStr] = payload.split(".");
  if (!userId || Number(expStr) < Date.now()) return null;
  return userId;
}

// --- OAuth flow ---

export function authorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "instagram_business_basic",
    state,
  });
  return `${OAUTH_BASE}?${p}`;
}

/** code → short-lived token → long-lived token (~60 days). */
export async function exchangeCode(code: string): Promise<{ accessToken: string; igUserId: string; expiresAt: Date }> {
  const form = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    client_secret: process.env.INSTAGRAM_APP_SECRET!,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
    code,
  });
  const shortRes = await fetch(TOKEN_URL, { method: "POST", body: form });
  if (!shortRes.ok) throw new Error(`ig_token_exchange_${shortRes.status}`);
  const short = (await shortRes.json()) as { access_token: string; user_id: number | string };

  const longRes = await fetch(
    `${GRAPH}/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${short.access_token}`
  );
  if (!longRes.ok) throw new Error(`ig_long_token_${longRes.status}`);
  const long = (await longRes.json()) as { access_token: string; expires_in: number };

  return {
    accessToken: long.access_token,
    igUserId: String(short.user_id),
    expiresAt: new Date(Date.now() + long.expires_in * 1000),
  };
}

/** Refresh a long-lived token (must be ≥24h old, not expired). */
export async function refreshToken(token: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch(`${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`);
  if (!res.ok) throw new Error(`ig_refresh_${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: j.access_token, expiresAt: new Date(Date.now() + j.expires_in * 1000) };
}

export interface IgMedia {
  id: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  caption?: string;
  timestamp?: string;
  username?: string;
}

/** Latest media for the connected account (CDN URLs are short-lived — re-host!). */
export async function fetchMedia(token: string, limit = 12): Promise<IgMedia[]> {
  const fields = "id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,username";
  const res = await fetch(`${GRAPH}/me/media?fields=${fields}&limit=${limit}&access_token=${token}`);
  if (!res.ok) throw new Error(`ig_media_${res.status}`);
  const j = (await res.json()) as { data?: IgMedia[] };
  return j.data ?? [];
}
