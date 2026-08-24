import { describe, it, expect } from "vitest";
import { menuButtonAudience } from "./menu-button-backfill";

describe("menuButtonAudience — who gets a refreshed menu button", () => {
  it("targets paired, unblocked, active accounts", () => {
    const w = menuButtonAudience();
    expect(w.telegramId).toEqual({ not: null });
    expect(w.telegramBlockedAt).toBeNull();
    expect(w.status).toBe("ACTIVE");
  });

  it("does NOT filter on notifyTelegram", () => {
    // The menu button is interface configuration, not a notification. A user who muted our
    // messages still opens the Mini App, and excluding them would leave them flashing web
    // chrome forever. This differs deliberately from the broadcast audience.
    expect(menuButtonAudience().notifyTelegram).toBeUndefined();
  });

  it("does not constrain by role or recency", () => {
    const w = menuButtonAudience();
    expect(w.isSeller).toBeUndefined();
    expect(w.lastSeenAt).toBeUndefined();
  });
});
