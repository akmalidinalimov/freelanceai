import { describe, it, expect, beforeAll } from "vitest";
import { MINIAPP_PARAM } from "@/lib/miniapp";

/**
 * Every web_app URL the bot emits must carry the Mini App marker, or the first paint inside
 * Telegram flashes our web chrome before the client can suppress it.
 *
 * There are THREE builders (the persistent reply keyboard, the chat menu button, and miniAppUrl)
 * and the reply keyboard is the primary entry point. An earlier draft only marked miniAppUrl,
 * which would have left the most-used buttons unmarked — hence a test per builder.
 */
let miniAppUrl: (locale: string | undefined, path: string) => string;
let tgMainKeyboard: (locale: string | undefined, isSeller: boolean, isAdmin?: boolean) => Record<string, unknown>;

beforeAll(async () => {
  process.env.APP_ORIGIN = "https://gigora.ai";
  const mod = await import("@/lib/telegram-bot");
  miniAppUrl = mod.miniAppUrl;
  tgMainKeyboard = mod.tgMainKeyboard;
});

const marked = (u: string) => u.includes(`${MINIAPP_PARAM}=1`);

describe("miniAppUrl", () => {
  it("marks a plain path", () => {
    expect(miniAppUrl("uz", "/onboarding")).toBe(`https://gigora.ai/uz/onboarding?${MINIAPP_PARAM}=1`);
  });

  it("keeps a #fragment AFTER the query, not swallowed by it", () => {
    // Callers pass paths like "/dashboard/seller#orders"; a naive concat produces
    // "#orders?tgapp=1", where the param becomes part of the fragment and never reaches the server.
    const u = miniAppUrl("uz", "/dashboard/seller#orders");
    expect(u).toBe(`https://gigora.ai/uz/dashboard/seller?${MINIAPP_PARAM}=1#orders`);
  });

  it("appends with & when the path already has a query", () => {
    expect(miniAppUrl("ru", "/gigs?q=video")).toBe(`https://gigora.ai/ru/gigs?q=video&${MINIAPP_PARAM}=1`);
  });

  it("defaults an unknown locale to uz", () => {
    expect(miniAppUrl("fr", "/search")).toContain("/uz/search");
  });
});

describe("tgMainKeyboard — the primary entry point", () => {
  const urls = (kb: Record<string, unknown>): string[] => {
    const rows = kb.keyboard as { text: string; web_app?: { url: string } }[][];
    return rows.flat().map((b) => b.web_app?.url).filter((u): u is string => Boolean(u));
  };

  it("marks every web_app button for a buyer", () => {
    const found = urls(tgMainKeyboard("uz", false));
    expect(found.length).toBeGreaterThan(0);
    for (const u of found) expect(marked(u), u).toBe(true);
  });

  it("marks every web_app button for a seller", () => {
    const found = urls(tgMainKeyboard("uz", true));
    expect(found.length).toBeGreaterThan(0);
    for (const u of found) expect(marked(u), u).toBe(true);
  });

  it("marks every web_app button for an admin", () => {
    const found = urls(tgMainKeyboard("uz", false, true));
    expect(found.length).toBeGreaterThan(0);
    for (const u of found) expect(marked(u), u).toBe(true);
  });

  it("keeps the seller's #orders / #gigs fragments intact", () => {
    const found = urls(tgMainKeyboard("uz", true));
    const frag = found.filter((u) => u.includes("#"));
    expect(frag.length).toBeGreaterThan(0);
    for (const u of frag) {
      // marker must sit in the query, before the fragment
      expect(u.indexOf(`${MINIAPP_PARAM}=1`), u).toBeLessThan(u.indexOf("#"));
    }
  });
});
