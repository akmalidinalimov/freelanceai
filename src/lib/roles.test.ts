import { describe, it, expect } from "vitest";
import { parseAdminIds, resolveRole, isDemotion } from "./roles";

describe("parseAdminIds", () => {
  it("parses a comma-separated list, trimming + dropping blanks", () => {
    const s = parseAdminIds(" 111 , 222,, 333 ");
    expect([...s].sort()).toEqual(["111", "222", "333"]);
  });
  it("handles undefined/empty", () => {
    expect(parseAdminIds(undefined).size).toBe(0);
    expect(parseAdminIds("").size).toBe(0);
  });
});

describe("resolveRole", () => {
  const admins = parseAdminIds("42,99");
  it("grants ADMIN to allowlisted ids", () => {
    expect(resolveRole("42", admins)).toBe("ADMIN");
  });
  it("everyone else is BUYER (member tier)", () => {
    expect(resolveRole("7", admins)).toBe("BUYER");
  });
});

describe("isDemotion", () => {
  it("true only when admin is stripped", () => {
    expect(isDemotion("ADMIN", "BUYER")).toBe(true);
    expect(isDemotion("BUYER", "ADMIN")).toBe(false);
    expect(isDemotion("ADMIN", "ADMIN")).toBe(false);
    expect(isDemotion(undefined, "BUYER")).toBe(false);
  });
});
