import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyLoginWidget, verifyMiniAppInitData } from "./telegram";

const BOT_TOKEN = "123456:TEST_BOT_TOKEN_abcDEF";
const NOW = 1_700_000_000; // fixed "now" for deterministic freshness checks

/** Re-implement the widget signing to produce a valid hash for tests. */
function signWidget(fields: Record<string, string>): string {
  const dcs = Object.keys(fields)
    .filter((k) => k !== "hash")
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = crypto.createHash("sha256").update(BOT_TOKEN).digest();
  return crypto.createHmac("sha256", secret).update(dcs).digest("hex");
}

function makeWidgetData(authDate: number) {
  const fields: Record<string, string> = {
    id: "42",
    first_name: "Akmal",
    username: "akmal",
    auth_date: String(authDate),
  };
  fields.hash = signWidget(fields);
  return fields;
}

describe("verifyLoginWidget", () => {
  it("accepts a valid, fresh signature", () => {
    const data = makeWidgetData(NOW - 10);
    const user = verifyLoginWidget(data, {
      botToken: BOT_TOKEN,
      nowSeconds: NOW,
    });
    expect(user).not.toBeNull();
    expect(user?.id).toBe("42");
    expect(user?.username).toBe("akmal");
  });

  it("rejects a forged/tampered hash", () => {
    const data = makeWidgetData(NOW - 10);
    data.hash = "deadbeef".repeat(8); // 64 hex chars but wrong
    expect(
      verifyLoginWidget(data, { botToken: BOT_TOKEN, nowSeconds: NOW })
    ).toBeNull();
  });

  it("rejects when a field is tampered after signing", () => {
    const data = makeWidgetData(NOW - 10);
    data.id = "9999"; // changed without re-signing
    expect(
      verifyLoginWidget(data, { botToken: BOT_TOKEN, nowSeconds: NOW })
    ).toBeNull();
  });

  it("rejects a stale auth_date (replay protection)", () => {
    const data = makeWidgetData(NOW - 48 * 60 * 60); // 48h old
    expect(
      verifyLoginWidget(data, { botToken: BOT_TOKEN, nowSeconds: NOW })
    ).toBeNull();
  });

  it("rejects a future-dated auth_date beyond skew tolerance", () => {
    const data = makeWidgetData(NOW + 3600); // 1h in the future
    expect(
      verifyLoginWidget(data, { botToken: BOT_TOKEN, nowSeconds: NOW })
    ).toBeNull();
  });

  it("rejects when the wrong bot token is used", () => {
    const data = makeWidgetData(NOW - 10);
    expect(
      verifyLoginWidget(data, { botToken: "999:WRONG", nowSeconds: NOW })
    ).toBeNull();
  });
});

/** Sign Mini App initData (different secret derivation). */
function signMiniApp(params: Record<string, string>): string {
  const dcs = Object.keys(params)
    .filter((k) => k !== "hash")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("\n");
  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();
  return crypto.createHmac("sha256", secret).update(dcs).digest("hex");
}

describe("verifyMiniAppInitData", () => {
  function makeInitData(authDate: number) {
    const params: Record<string, string> = {
      auth_date: String(authDate),
      user: JSON.stringify({ id: 7, first_name: "Lola", username: "lola" }),
    };
    params.hash = signMiniApp(params);
    return new URLSearchParams(params).toString();
  }

  it("accepts valid initData and extracts the user", () => {
    const user = verifyMiniAppInitData(makeInitData(NOW - 5), {
      botToken: BOT_TOKEN,
      nowSeconds: NOW,
    });
    expect(user?.id).toBe("7");
    expect(user?.firstName).toBe("Lola");
  });

  it("rejects tampered initData", () => {
    const initData = makeInitData(NOW - 5).replace("Lola", "Hacker");
    expect(
      verifyMiniAppInitData(initData, { botToken: BOT_TOKEN, nowSeconds: NOW })
    ).toBeNull();
  });
});
