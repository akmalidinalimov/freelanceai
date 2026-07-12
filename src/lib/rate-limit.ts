import "server-only";
import crypto from "crypto";
import { Errors } from "./api";

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets (only meaningful when !ok). */
  retryAfterSec: number;
  /** Remaining requests in the current window. */
  remaining: number;
}

/**
 * Pluggable rate-limit backend. The policy contract (key + limit + window → decision) is
 * stable; only the STORAGE changes between deploys. `check` is the single seam a distributed
 * backend implements.
 *
 * NOTE (Wave-1, docs/adr): the current backend is in-memory — correct for ONE app instance,
 * but per-instance and reset on restart. A second instance (horizontal scale) needs a shared
 * store (Redis token bucket). A network backend is async, so adding it promotes this method +
 * the public helpers below to Promise-returning and awaits the ~35 call sites in one contained
 * change. Kept synchronous until Redis is actually provisioned, to avoid a silent-bypass
 * regression (a missed await isn't caught by next/typescript lint) for infra not yet deployed.
 */
export interface RateLimiterBackend {
  check(key: string, limit: number, windowMs: number): RateLimitResult;
}

/** In-memory fixed-window backend. Adequate for a single app instance (our current deploy). */
export class MemoryRateLimiter implements RateLimiterBackend {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  // Occasional sweep of expired buckets so the map can't grow unbounded under attack.
  private sweep(now: number) {
    if (this.buckets.size < 5000) return;
    for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
  }

  check(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || b.resetAt <= now) {
      this.sweep(now);
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, retryAfterSec: 0, remaining: limit - 1 };
    }
    if (b.count >= limit) {
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)), remaining: 0 };
    }
    b.count += 1;
    return { ok: true, retryAfterSec: 0, remaining: limit - b.count };
  }
}

/** Select the backend from env. Only "memory" is wired today; the switch is the config seam. */
function createBackend(): RateLimiterBackend {
  const kind = process.env.RATE_LIMIT_BACKEND ?? "memory";
  if (kind !== "memory") {
    // Fail loud: a deploy that asks for a backend we haven't wired must not silently fall back
    // to per-instance memory (which would quietly nullify limiting across multiple instances).
    throw new Error(`RATE_LIMIT_BACKEND="${kind}" is not implemented — only "memory" is wired`);
  }
  return new MemoryRateLimiter();
}

// One backend per process. Swapping to a shared store is a change to createBackend() only.
const backend: RateLimiterBackend = createBackend();

/** Fixed-window check that also reports retry-after / remaining for headers. */
export function rateLimitInfo(key: string, limit: number, windowMs: number): RateLimitResult {
  return backend.check(key, limit, windowMs);
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
