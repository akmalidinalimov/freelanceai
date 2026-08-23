import { describe, it, expect } from "vitest";
import {
  shouldExpireSession,
  absoluteExpiry,
  ABSOLUTE_SESSION_MAX_AGE_SEC,
} from "@/lib/session-policy";

/**
 * Sessions roll forward from last use so an active user is never logged out. Without a ceiling
 * that is not a session, it is a permanent credential: a cookie exfiltrated once, or a device kept
 * after it changed hands, stays valid indefinitely as long as something touches it inside the
 * window. These pin the ceiling.
 */
const NOW = 1_800_000_000;

describe("shouldExpireSession", () => {
  it("keeps a session alive before its absolute expiry", () => {
    expect(shouldExpireSession({ absExp: NOW + 60 }, NOW)).toBe(false);
  });

  it("expires it at the boundary, not a second later", () => {
    expect(shouldExpireSession({ absExp: NOW }, NOW)).toBe(true);
    expect(shouldExpireSession({ absExp: NOW - 1 }, NOW)).toBe(true);
  });

  it("does NOT retroactively log out tokens issued before this existed", () => {
    // A missing absExp means the token predates the policy. Expiring those on deploy would sign
    // out every existing user at once — a self-inflicted outage, not a security improvement.
    expect(shouldExpireSession({}, NOW)).toBe(false);
  });

  it("ignores a non-numeric absExp rather than throwing on a malformed token", () => {
    expect(shouldExpireSession({ absExp: "soon" }, NOW)).toBe(false);
    expect(shouldExpireSession({ absExp: null }, NOW)).toBe(false);
  });

  it("stamps 90 days ahead, and the ceiling exceeds the 30-day rolling window", () => {
    expect(absoluteExpiry(NOW)).toBe(NOW + ABSOLUTE_SESSION_MAX_AGE_SEC);
    // If the ceiling were shorter than the rolling window it would cut active users off early.
    expect(ABSOLUTE_SESSION_MAX_AGE_SEC).toBeGreaterThan(30 * 24 * 60 * 60);
  });

  it("caps a session that keeps being refreshed", () => {
    // The scenario the ceiling exists for: touched every 29 days, forever.
    const issued = NOW;
    const exp = absoluteExpiry(issued);
    expect(shouldExpireSession({ absExp: exp }, issued + 89 * 24 * 60 * 60)).toBe(false);
    expect(shouldExpireSession({ absExp: exp }, issued + 91 * 24 * 60 * 60)).toBe(true);
  });
});
