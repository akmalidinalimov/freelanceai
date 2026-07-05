import "server-only";
import crypto from "crypto";
import { Errors } from "./api";

/**
 * Minimal in-memory fixed-window rate limiter. Adequate for a single app instance
 * (our current deploy). Replace with a Redis token bucket when we scale horizontally.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

// Occasional sweep of expired buckets so the map can't grow unbounded under attack.
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets (only meaningful when !ok). */
  retryAfterSec: number;
  /** Remaining requests in the current window. */
  remaining: number;
}

/** Fixed-window check that also reports retry-after / remaining for headers. */
export function rateLimitInfo(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    sweep(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0, remaining: limit - 1 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)), remaining: 0 };
  }
  b.count += 1;
  return { ok: true, retryAfterSec: 0, remaining: limit - b.count };
}

/** Boolean fixed-window rate limiter (back-compat wrapper over rateLimitInfo). */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  return rateLimitInfo(key, limit, windowMs).ok;
}

/** Throw a RATE_LIMITED ApiError (with an accurate Retry-After) when the window is exceeded. */
export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const r = rateLimitInfo(key, limit, windowMs);
  if (!r.ok) throw Errors.rateLimited(undefined, r.retryAfterSec);
}

/**
 * Client IP for rate-limit keying. Cloudflare (tunnel) sets `cf-connecting-ip` and is the
 * authoritative source in prod. `x-forwarded-for` is CLIENT-SPOOFABLE — trusting it lets an
 * attacker set a unique value per request and get a fresh bucket every time (rate limiting
 * nullified). So in production we key on `cf-connecting-ip` only, collapsing its absence to a
 * shared "unknown" bucket; the XFF fallback is kept for local/dev where there's no CF in front.
 */
export function clientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  if (process.env.NODE_ENV !== "production")
    return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return "unknown";
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Read a single cookie value from a request (no parsing deps). */
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}
