import { describe, it, expect, vi } from "vitest";
import {
  crossSiteCookieOptions,
  isMiniAppRequest,
  isRootPath,
  isSecureRequest,
  MINIAPP_HEADER,
  MINIAPP_ROOT_PATHS,
} from "@/lib/miniapp";

/** Minimal stand-in for the Headers object the middleware hands to the layout. */
const headers = (v?: string) => ({ get: (n: string) => (n === MINIAPP_HEADER && v ? v : null) });

describe("isMiniAppRequest", () => {
  it("is true when the middleware marked the request", () => {
    expect(isMiniAppRequest(headers("1"))).toBe(true);
  });

  it("is false with no marker — the plain web case, which must never regress", () => {
    expect(isMiniAppRequest(headers())).toBe(false);
  });

  it("is false for any value other than the exact marker", () => {
    // Guards against a truthy-string bug quietly turning every request into a Mini App request.
    expect(isMiniAppRequest(headers("0"))).toBe(false);
    expect(isMiniAppRequest(headers("true"))).toBe(false);
  });
});

describe("isRootPath", () => {
  it("treats each root screen as root, with or without a locale prefix", () => {
    for (const p of MINIAPP_ROOT_PATHS) {
      expect(isRootPath(p), p).toBe(true);
      expect(isRootPath(`/uz${p === "/" ? "" : p}`), `/uz${p}`).toBe(true);
      expect(isRootPath(`/ru${p === "/" ? "" : p}`), `/ru${p}`).toBe(true);
    }
  });

  it("treats deeper screens as non-root, so BackButton shows", () => {
    for (const p of ["/uz/gigs/some-gig", "/uz/orders/abc123", "/uz/messages/xyz", "/en/dashboard/seller"]) {
      expect(isRootPath(p), p).toBe(false);
    }
  });

  it("does not mistake a path that merely starts with a locale-like segment", () => {
    // "/uzbek-guides" must not be read as locale "uz" + "/bek-guides".
    expect(isRootPath("/uzbek-guides")).toBe(false);
    expect(isRootPath("/uz")).toBe(true);
  });
});

/**
 * These pin the fix for the bug that made a signed-in user log in again on EVERY launch.
 *
 * Telegram Desktop and Telegram Web embed a Mini App in an iframe on telegram.org, so gigora.ai is
 * cross-site there and never receives a SameSite=Lax cookie — the session was written at login and
 * never sent back. Verified against production: framed from telegram.org, gigora.ai got no Cookie
 * header at all.
 */
describe("crossSiteCookieOptions — cookies that survive Telegram's iframe", () => {
  it("uses SameSite=None + Secure + Partitioned on HTTPS", () => {
    expect(crossSiteCookieOptions(true)).toEqual({
      sameSite: "none",
      secure: true,
      partitioned: true,
    });
  });

  it("never emits SameSite=None without Secure", () => {
    // A browser DROPS SameSite=None unless Secure is set, so an insecure origin must fall back to
    // Lax rather than emit a cookie that is silently discarded.
    const insecure = crossSiteCookieOptions(false);
    expect(insecure.sameSite).toBe("lax");
    expect(insecure.secure).toBe(false);
    expect(insecure.partitioned).toBe(false);
  });

  it("does not depend on NODE_ENV", () => {
    // Playwright runs `next start`, which forces NODE_ENV=production while serving plain
    // http://localhost. Keying on NODE_ENV would emit a cookie every local browser throws away.
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(crossSiteCookieOptions(false).secure).toBe(false);
      expect(crossSiteCookieOptions(true).secure).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("isSecureRequest", () => {
  const req = (proto: string | null, url = "http://localhost:3000/") => ({
    nextUrl: { protocol: new URL(url).protocol },
    headers: { get: (n: string) => (n === "x-forwarded-proto" ? proto : null) },
  });

  it("trusts x-forwarded-proto — production sits behind a Cloudflare tunnel", () => {
    expect(isSecureRequest(req("https"))).toBe(true);
  });

  it("reads only the FIRST hop of a comma-joined forwarded chain", () => {
    expect(isSecureRequest(req("https, http"))).toBe(true);
    expect(isSecureRequest(req("http, https"))).toBe(false);
  });

  it("falls back to the URL protocol when the header is absent", () => {
    expect(isSecureRequest(req(null, "https://gigora.ai/"))).toBe(true);
    expect(isSecureRequest(req(null, "http://localhost:3000/"))).toBe(false);
  });
});
