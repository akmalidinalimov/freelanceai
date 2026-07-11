import { describe, it, expect } from "vitest";
import { tashkentDay } from "@/server/services/gamification";

/**
 * tashkentDay must key to the Tashkent (UTC+5) calendar day, not the UTC day — the
 * reminder cron and the streak writer both rely on it, and a UTC-day window disagrees
 * with a Tashkent-day write between 00:00–05:00 Tashkent (T10 fix).
 */
describe("tashkentDay (UTC+5 day key)", () => {
  it("02:00 UTC still belongs to the SAME Tashkent day (07:00 local)", () => {
    // 2026-03-10T02:00Z → 07:00 Tashkent → Tashkent day = the 10th (midnight-UTC key).
    expect(tashkentDay(new Date("2026-03-10T02:00:00Z")).toISOString().slice(0, 10)).toBe("2026-03-10");
  });

  it("22:00 UTC rolls into the NEXT Tashkent day (03:00 local next day)", () => {
    // 2026-03-10T22:00Z → 03:00 Tashkent on the 11th → Tashkent day = the 11th.
    expect(tashkentDay(new Date("2026-03-10T22:00:00Z")).toISOString().slice(0, 10)).toBe("2026-03-11");
  });

  it("differs from the naive UTC day exactly in the 19:00–24:00 UTC window", () => {
    const t = new Date("2026-06-01T20:30:00Z"); // 01:30 Tashkent on the 2nd
    const utcDay = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())).toISOString().slice(0, 10);
    expect(utcDay).toBe("2026-06-01");
    expect(tashkentDay(t).toISOString().slice(0, 10)).toBe("2026-06-02"); // the bug this fix prevents
  });
});
