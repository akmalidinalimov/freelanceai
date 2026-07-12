import { describe, it, expect } from "vitest";
import { audienceWhere } from "./broadcast";

describe("audienceWhere — broadcast recipient filter", () => {
  it("always requires a reachable, not-blocked, Telegram-enabled, active account", () => {
    for (const a of ["ALL", "BUYERS", "SELLERS", "ACTIVE_30D"] as const) {
      const w = audienceWhere(a);
      expect(w.telegramId).toEqual({ not: null });
      expect(w.telegramBlockedAt).toBeNull();
      expect(w.notifyTelegram).toBe(true);
      expect(w.status).toBe("ACTIVE");
    }
  });

  it("ALL does not constrain by role or recency", () => {
    const w = audienceWhere("ALL");
    expect(w.isSeller).toBeUndefined();
    expect(w.lastSeenAt).toBeUndefined();
  });

  it("BUYERS targets non-sellers only", () => {
    expect(audienceWhere("BUYERS").isSeller).toBe(false);
  });

  it("SELLERS targets sellers only", () => {
    expect(audienceWhere("SELLERS").isSeller).toBe(true);
  });

  it("ACTIVE_30D constrains to users seen within the last 30 days", () => {
    const before = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const w = audienceWhere("ACTIVE_30D");
    const gte = (w.lastSeenAt as { gte: Date }).gte;
    expect(gte).toBeInstanceOf(Date);
    // Within a small tolerance of "now minus 30 days" (guards against unit slips).
    expect(Math.abs(gte.getTime() - before)).toBeLessThan(5000);
  });
});
