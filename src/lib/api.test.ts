import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ApiError, Errors, parseInput, zodFieldErrors, errorResponse, ok } from "./api";

describe("ApiError", () => {
  it("maps codes to statuses", () => {
    expect(Errors.unauthenticated().status).toBe(401);
    expect(Errors.forbidden().status).toBe(403);
    expect(Errors.notFound().status).toBe(404);
    expect(Errors.validation({}).status).toBe(422);
    expect(Errors.rateLimited().status).toBe(429);
  });
});

describe("parseInput", () => {
  const schema = z.object({ title: z.string().min(3) }).strict();

  it("returns parsed data on success", () => {
    expect(parseInput(schema, { title: "hello" })).toEqual({ title: "hello" });
  });

  it("throws VALIDATION with field errors on bad input", () => {
    try {
      parseInput(schema, { title: "x" });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe("VALIDATION");
      expect((e as ApiError).fields).toHaveProperty("title");
    }
  });

  it("rejects unknown keys (.strict)", () => {
    expect(() => parseInput(schema, { title: "hello", evil: 1 })).toThrow(ApiError);
  });
});

describe("zodFieldErrors", () => {
  it("keys errors by path", () => {
    const r = z.object({ a: z.string() }).safeParse({ a: 1 });
    expect(r.success).toBe(false);
    if (!r.success) expect(zodFieldErrors(r.error)).toHaveProperty("a");
  });
});

describe("errorResponse", () => {
  it("does not leak details for unknown errors (500)", async () => {
    const res = errorResponse(new Error("secret stack detail"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL");
    expect(JSON.stringify(body)).not.toContain("secret stack detail");
  });

  it("preserves ApiError code/status/fields", async () => {
    const res = errorResponse(Errors.validation({ title: "required" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
    expect(body.error.fields.title).toBe("required");
  });
});

describe("ok", () => {
  it("wraps data in the success envelope", async () => {
    const res = ok({ id: "1" });
    const body = await res.json();
    expect(body).toEqual({ ok: true, data: { id: "1" } });
  });
});
