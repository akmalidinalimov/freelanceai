import { describe, it, expect } from "vitest";
import { foldToLatin } from "./translit";

describe("foldToLatin (Cyrillic → Latin search fold)", () => {
  it("folds Uzbek/Russian Cyrillic to Latin", () => {
    expect(foldToLatin("дизайн")).toBe("dizayn");
    expect(foldToLatin("логотип")).toBe("logotip");
    expect(foldToLatin("видео")).toBe("video");
    expect(foldToLatin("монтаж")).toBe("montaj");
    expect(foldToLatin("реклама")).toBe("reklama");
  });
  it("leaves Latin input unchanged (no regression)", () => {
    expect(foldToLatin("dizayn")).toBe("dizayn");
    expect(foldToLatin("logo design")).toBe("logo design");
    expect(foldToLatin("ai video 3d")).toBe("ai video 3d");
  });
  it("a Cyrillic query and its Latin equivalent fold to the same token", () => {
    expect(foldToLatin("дизайн")).toBe(foldToLatin("dizayn"));
  });
  it("handles multi-char mappings and drops hard/soft signs", () => {
    expect(foldToLatin("шч")).toBe("shch");
    expect(foldToLatin("объект")).toBe("obekt");
  });
});
