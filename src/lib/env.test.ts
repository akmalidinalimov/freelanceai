import { describe, it, expect } from "vitest";
import { parseEnv } from "./env";

const base = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db?schema=public",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  SESSION_SECRET: "a-sufficiently-long-secret",
};

describe("parseEnv", () => {
  it("accepts a valid dev env and applies defaults", () => {
    const env = parseEnv(base);
    expect(env.PLATFORM_COMMISSION_PCT).toBe(20); // default
    expect(env.NODE_ENV).toBe("development");
  });

  it("coerces PLATFORM_COMMISSION_PCT from string", () => {
    expect(parseEnv({ ...base, PLATFORM_COMMISSION_PCT: "15" }).PLATFORM_COMMISSION_PCT).toBe(15);
  });

  it("rejects a missing DATABASE_URL", () => {
    const { DATABASE_URL, ...rest } = base;
    void DATABASE_URL;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it("rejects a weak SESSION_SECRET", () => {
    expect(() => parseEnv({ ...base, SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET/);
  });

  it("rejects a non-url APP_URL", () => {
    expect(() => parseEnv({ ...base, NEXT_PUBLIC_APP_URL: "not-a-url" })).toThrow();
  });

  it("requires bot token/username/webhook secret in production", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: "production" })).toThrow(/TELEGRAM_BOT_TOKEN/);
    // ...passes when all production-required fields are present
    expect(() =>
      parseEnv({
        ...base,
        NODE_ENV: "production",
        TELEGRAM_BOT_TOKEN: "123:abc",
        TELEGRAM_BOT_USERNAME: "aifrilance_bot",
        TELEGRAM_WEBHOOK_SECRET: "a-sufficiently-long-secret",
        AUTH_SECRET: "another-sufficiently-long-secret",
      })
    ).not.toThrow();
  });

  it("rejects out-of-range commission", () => {
    expect(() => parseEnv({ ...base, PLATFORM_COMMISSION_PCT: "150" })).toThrow();
  });
});
