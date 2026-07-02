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

  it("THROWS in production when the key is missing (never plaintext at rest)", async () => {
    const { encryptPII } = await import("./pii-crypto");
    const savedKey = process.env.PII_ENCRYPTION_KEY;
    const savedEnv = process.env.NODE_ENV;
    try {
      delete process.env.PII_ENCRYPTION_KEY;
      // @ts-expect-error NODE_ENV is typed readonly by Next, mutable at runtime
      process.env.NODE_ENV = "production";
      expect(() => encryptPII("+998933333333")).toThrow(/PII_ENCRYPTION_KEY/);
    } finally {
      process.env.PII_ENCRYPTION_KEY = savedKey;
      // @ts-expect-error restore
      process.env.NODE_ENV = savedEnv;
    }
  });

  it("passes through with a warning outside production when the key is missing", async () => {
    const { encryptPII } = await import("./pii-crypto");
    const savedKey = process.env.PII_ENCRYPTION_KEY;
    try {
      delete process.env.PII_ENCRYPTION_KEY;
      expect(encryptPII("+998944444444")).toBe("+998944444444");
    } finally {
      process.env.PII_ENCRYPTION_KEY = savedKey;
    }
  });
});
