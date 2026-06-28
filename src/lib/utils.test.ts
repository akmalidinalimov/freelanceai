import { describe, it, expect } from "vitest";
import { cn, formatUzs } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });
  it("dedupes conflicting tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
  it("handles conditional values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});

describe("formatUzs", () => {
  it("formats integer UZS with grouping", () => {
    // Uzbek locale uses a space as the thousands separator.
    expect(formatUzs(150000).replace(/ | /g, " ")).toBe("150 000");
  });
  it("rounds to whole UZS (no decimals)", () => {
    expect(formatUzs(1234.6)).toBe(formatUzs(1235));
  });
});
