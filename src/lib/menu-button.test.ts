import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { MINIAPP_PARAM } from "@/lib/miniapp";

/**
 * The menu button is the single most-used way into the Mini App, and Telegram stores whatever URL
 * we send it PER CHAT, permanently, until we send another. So the URL in this request body is not
 * a detail — if the marker is missing from it, every launch through that button renders our web
 * chrome server-side first and flashes.
 *
 * These assert the outgoing Bot API request, which is the only place that guarantee is observable.
 */
let tgSetChatMenuButtonResult: (
  chatId: number | string,
  locale?: string
) => Promise<{ ok: boolean; blocked: boolean; retryAfter?: number }>;

type Captured = { url: string; body: Record<string, unknown> };
let sent: Captured[] = [];

function mockFetch(status: number, body: unknown) {
  return vi.fn(async (url: unknown, init?: { body?: string }) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : {} });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as unknown as Response;
  });
}

beforeAll(async () => {
  process.env.APP_ORIGIN = "https://gigora.ai";
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  const mod = await import("@/lib/telegram-bot");
  tgSetChatMenuButtonResult = mod.tgSetChatMenuButtonResult;
});

afterEach(() => {
  sent = [];
  vi.unstubAllGlobals();
});

const menuUrl = () => {
  const mb = sent[0]?.body.menu_button as { web_app?: { url?: string }; type?: string; text?: string };
  return { url: mb?.web_app?.url ?? "", type: mb?.type, text: mb?.text };
};

describe("tgSetChatMenuButtonResult", () => {
  it("sends a web_app button whose URL carries the Mini App marker", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { ok: true }));
    const res = await tgSetChatMenuButtonResult(12345, "uz");

    expect(res).toEqual({ ok: true, blocked: false });
    expect(sent[0].url).toContain("/setChatMenuButton");
    expect(sent[0].body.chat_id).toBe(12345);
    const { url, type } = menuUrl();
    expect(type).toBe("web_app");
    expect(url).toBe(`https://gigora.ai/uz/?${MINIAPP_PARAM}=1`);
  });

  it("localises both the URL and the button label", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { ok: true }));
    await tgSetChatMenuButtonResult(1, "ru");
    const ru = menuUrl();
    expect(ru.url).toContain("/ru/");
    expect(ru.url).toContain(`${MINIAPP_PARAM}=1`);

    sent = [];
    await tgSetChatMenuButtonResult(1, "en");
    const en = menuUrl();
    expect(en.url).toContain("/en/");
    expect(en.text).not.toBe(ru.text); // a Russian user must not get an English label
  });

  it("falls back to uz for an unknown locale", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { ok: true }));
    await tgSetChatMenuButtonResult(1, "fr");
    expect(menuUrl().url).toContain("/uz/");
  });

  it("reports a 403 as blocked so the backfill can stop retrying that user", async () => {
    vi.stubGlobal("fetch", mockFetch(403, { ok: false, description: "bot was blocked by the user" }));
    expect(await tgSetChatMenuButtonResult(1, "uz")).toEqual({
      ok: false,
      blocked: true,
      retryAfter: undefined,
    });
  });

  it("surfaces retry_after on a 429 rather than swallowing the flood wait", async () => {
    vi.stubGlobal("fetch", mockFetch(429, { ok: false, parameters: { retry_after: 7 } }));
    const res = await tgSetChatMenuButtonResult(1, "uz");
    expect(res.ok).toBe(false);
    expect(res.blocked).toBe(false);
    expect(res.retryAfter).toBe(7);
  });

  it("treats a 200 body of ok:false as a failure, not a success", async () => {
    // Telegram can answer 200 with ok:false; counting that as sent would silently under-report.
    vi.stubGlobal("fetch", mockFetch(200, { ok: false, description: "chat not found" }));
    expect((await tgSetChatMenuButtonResult(1, "uz")).ok).toBe(false);
  });

  it("never throws when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNRESET"); }));
    expect(await tgSetChatMenuButtonResult(1, "uz")).toEqual({ ok: false, blocked: false });
  });
});
