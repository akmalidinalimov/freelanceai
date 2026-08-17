import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getWebApp, inTelegram, type TelegramWebApp } from "@/components/telegram/use-telegram";

/**
 * The contract these lock down: an OLD Telegram client must get no-ops, never a throw. That is the
 * failure mode that turns a Mini App into a blank screen for a slice of users you cannot see.
 *
 * The hook itself needs React, so these test the pure exports plus a hand-rolled call of the same
 * guard logic against version stubs.
 */
function stub(wa: Partial<TelegramWebApp> | undefined) {
  (globalThis as unknown as { window?: unknown }).window = wa === undefined ? {} : { Telegram: { WebApp: wa } };
}

beforeEach(() => stub(undefined));
afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
  vi.restoreAllMocks();
});

describe("getWebApp", () => {
  it("returns undefined when there is no window at all (server render)", () => {
    delete (globalThis as unknown as { window?: unknown }).window;
    expect(getWebApp()).toBeUndefined();
  });

  it("returns undefined when Telegram is absent (plain browser)", () => {
    expect(getWebApp()).toBeUndefined();
  });

  it("returns the WebApp when Telegram injected it", () => {
    stub({ initData: "x", version: "7.0" });
    expect(getWebApp()).toBeDefined();
  });
});

describe("inTelegram", () => {
  it("is false with no SDK", () => {
    expect(inTelegram()).toBe(false);
  });

  it("is false when the SDK exists but initData is empty", () => {
    // telegram-web-app.js loads in a normal browser too and exposes an EMPTY initData. Treating
    // that as "in Telegram" would strip the chrome from ordinary web visitors.
    stub({ initData: "", version: "7.0" });
    expect(inTelegram()).toBe(false);
  });

  it("is true only with signed initData present", () => {
    stub({ initData: "auth_date=1&hash=abc", version: "7.0" });
    expect(inTelegram()).toBe(true);
  });
});

describe("version gating", () => {
  const callIfSupported = (min: string, fn: (wa: TelegramWebApp) => void) => {
    const wa = getWebApp();
    if (!wa || !inTelegram()) return;
    if (typeof wa.isVersionAtLeast !== "function" || !wa.isVersionAtLeast(min)) return;
    fn(wa);
  };

  it("skips the call on a client too old to support it", () => {
    const setHeaderColor = vi.fn();
    stub({ initData: "x", version: "6.0", isVersionAtLeast: (v) => v <= "6.0", setHeaderColor });
    callIfSupported("6.1", (wa) => wa.setHeaderColor?.("#fff"));
    expect(setHeaderColor).not.toHaveBeenCalled();
  });

  it("calls through on a new enough client", () => {
    const setHeaderColor = vi.fn();
    stub({ initData: "x", version: "7.0", isVersionAtLeast: () => true, setHeaderColor });
    callIfSupported("6.1", (wa) => wa.setHeaderColor?.("#fff"));
    expect(setHeaderColor).toHaveBeenCalledWith("#fff");
  });

  it("skips when the client predates isVersionAtLeast entirely", () => {
    const setHeaderColor = vi.fn();
    stub({ initData: "x", setHeaderColor });
    callIfSupported("6.1", (wa) => wa.setHeaderColor?.("#fff"));
    expect(setHeaderColor).not.toHaveBeenCalled();
  });
});
