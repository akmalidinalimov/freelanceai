import { describe, it, expect, beforeAll } from "vitest";
import crypto from "node:crypto";

beforeAll(() => {
  process.env.PII_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
});

describe("pii-crypto", () => {
  it("round-trips a phone number", async () => {
    const { encryptPII, decryptPII } = await import("./pii-crypto");
    const enc = encryptPII("+998901234567")!;
    expect(enc).toMatch(/^enc\.v1\./);
    expect(enc).not.toContain("998901234567");
    expect(decryptPII(enc)).toBe("+998901234567");
  });

  it("does not double-encrypt", async () => {
    const { encryptPII, decryptPII } = await import("./pii-crypto");
    const once = encryptPII("+998900000000")!;
    expect(encryptPII(once)).toBe(once);
    expect(decryptPII(once)).toBe("+998900000000");
  });

  it("passes legacy plaintext through decrypt", async () => {
    const { decryptPII } = await import("./pii-crypto");
    expect(decryptPII("+998911111111")).toBe("+998911111111");
  });

  it("handles null/empty", async () => {
    const { encryptPII, decryptPII } = await import("./pii-crypto");
    expect(encryptPII(null)).toBeNull();
    expect(encryptPII("")).toBe("");
    expect(decryptPII(null)).toBeNull();
  });

  it("fails closed on tampered ciphertext", async () => {
    const { encryptPII, decryptPII } = await import("./pii-crypto");
    const enc = encryptPII("+998922222222")!;
    const tampered = enc.slice(0, -4) + "AAAA";
    expect(decryptPII(tampered)).toBe("•••");
  });
});
