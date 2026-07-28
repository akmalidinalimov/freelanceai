import { describe, it, expect } from "vitest";
import { isOnline, ONLINE_WINDOW_MS } from "./presence";

const NOW = 1_800_000_000_000;

describe("isOnline — messaging presence heuristic", () => {
  it("is online when last seen just now", () => {
    expect(isOnline(NOW, NOW)).toBe(true);
  });

  it("is online when last seen within the window", () => {
    expect(isOnline(NOW - (ONLINE_WINDOW_MS - 1000), NOW)).toBe(true);
  });

  it("is offline exactly at / past the window boundary", () => {
    expect(isOnline(NOW - ONLINE_WINDOW_MS, NOW)).toBe(false);
    expect(isOnline(NOW - 2 * ONLINE_WINDOW_MS, NOW)).toBe(false);
  });

  it("treats a slightly-future timestamp (clock skew) as online", () => {
    expect(isOnline(NOW + 30_000, NOW)).toBe(true);
  });

  it("is offline when last-seen is unknown", () => {
    expect(isOnline(null, NOW)).toBe(false);
    expect(isOnline(undefined, NOW)).toBe(false);
  });
});
