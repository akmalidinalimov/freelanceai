import { describe, it, expect } from "vitest";
import { isMiniAppRequest, isRootPath, MINIAPP_HEADER, MINIAPP_ROOT_PATHS } from "@/lib/miniapp";

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
