import { describe, it, expect, vi, afterEach } from "vitest";
import { MemoryRateLimiter } from "./rate-limit";

/**
 * The rate-limiter backend seam: exercises the in-memory fixed-window policy directly through
 * the RateLimiterBackend interface. A future Redis backend must satisfy the same contract.
 */
describe("MemoryRateLimiter (fixed-window backend)", () => {
  afterEach(() => vi.useRealTimers());

  it("allows up to the limit, then blocks with a retry-after", () => {
    const rl = new MemoryRateLimiter();
    for (let i = 0; i < 3; i++) {
      const r = rl.check("k", 3, 60_000);
      expect(r.ok).toBe(true);
      expect(r.remaining).toBe(3 - 1 - i);
    }
    const blocked = rl.check("k", 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const rl = new MemoryRateLimiter();
    expect(rl.check("k", 1, 1_000).ok).toBe(true);
    expect(rl.check("k", 1, 1_000).ok).toBe(false); // window full
    vi.advanceTimersByTime(1_001); // window elapsed
    expect(rl.check("k", 1, 1_000).ok).toBe(true); // fresh window
  });

  it("keys are independent", () => {
    const rl = new MemoryRateLimiter();
    expect(rl.check("a", 1, 60_000).ok).toBe(true);
    expect(rl.check("a", 1, 60_000).ok).toBe(false);
    expect(rl.check("b", 1, 60_000).ok).toBe(true); // different key → own window
  });
});
