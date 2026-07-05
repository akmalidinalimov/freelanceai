import { describe, it, expect } from "vitest";
import { normalizeTelegramChannel, normalizeTelegramPost } from "@/lib/telegram-link";

describe("normalizeTelegramChannel", () => {
  it("accepts bare, @-prefixed, and t.me forms → bare handle", () => {
    expect(normalizeTelegramChannel("mychannel")).toBe("mychannel");
    expect(normalizeTelegramChannel("@mychannel")).toBe("mychannel");
    expect(normalizeTelegramChannel("t.me/mychannel")).toBe("mychannel");
    expect(normalizeTelegramChannel("https://t.me/mychannel")).toBe("mychannel");
    expect(normalizeTelegramChannel("https://t.me/mychannel/")).toBe("mychannel");
  });
  it("rejects too-short, illegal chars, and other hosts", () => {
    expect(normalizeTelegramChannel("ab")).toBeNull();
    expect(normalizeTelegramChannel("bad name")).toBeNull();
    expect(normalizeTelegramChannel("https://evil.com/x")).toBeNull();
    expect(normalizeTelegramChannel("")).toBeNull();
  });
});

describe("normalizeTelegramPost", () => {
  it("canonicalizes valid public post links", () => {
    expect(normalizeTelegramPost("https://t.me/durov/68")).toBe("https://t.me/durov/68");
    expect(normalizeTelegramPost("t.me/durov/68")).toBe("https://t.me/durov/68");
    expect(normalizeTelegramPost("http://t.me/durov/68?single")).toBe("https://t.me/durov/68");
    expect(normalizeTelegramPost("https://t.me/my_channel/1024#x")).toBe("https://t.me/my_channel/1024");
  });
  it("rejects private/invite links, channel-only links, and other hosts", () => {
    expect(normalizeTelegramPost("https://t.me/+AbCdEf123")).toBeNull(); // invite hash
    expect(normalizeTelegramPost("https://t.me/c/123456/7")).toBeNull(); // private /c/ link
    expect(normalizeTelegramPost("https://t.me/durov")).toBeNull(); // no message id
    expect(normalizeTelegramPost("https://evil.com/durov/68")).toBeNull();
    expect(normalizeTelegramPost("javascript:alert(1)")).toBeNull();
    expect(normalizeTelegramPost("")).toBeNull();
  });
});
