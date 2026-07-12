import { describe, it, expect } from "vitest";
import { parseIntent, budgetTierFor, gigSpecKeys } from "./match";
import { SPECIALIZATIONS } from "@/lib/specializations";

const keys = (q: string) => parseIntent(q).specKeys;

describe("parseIntent — token-based, no substring false positives", () => {
  it("does not detect tech_startup from the letters 'it' inside a word", () => {
    expect(keys("video editing")).not.toContain("tech_startup");
    expect(keys("fitness reels")).not.toContain("tech_startup");
  });

  it("does not detect ai_image from 'art' inside 'startap'", () => {
    expect(keys("startap uchun video")).not.toContain("ai_image");
  });

  it("still detects a whole-word single-token synonym", () => {
    expect(keys("it xizmatlari uchun startap")).toContain("tech_startup");
    expect(keys("3d render kerak")).toContain("render_3d");
  });

  it("matches correctly-spelled Uzbek despite apostrophes (oʻyin → gaming)", () => {
    expect(keys("oʻyin uchun trailer")).toContain("gaming");
    expect(keys("o'yin uchun trailer")).toContain("gaming");
    expect(keys("toʻy videosi")).toContain("events");
  });

  it("matches Cyrillic and multi-word phrases", () => {
    expect(keys("видео для рекламы")).toContain("ai_video");
    expect(keys("koʻchmas mulk uchun rolik")).toContain("real_estate");
  });
});

describe("budgetTierFor — from-price → 1/2/3 (no exact price ever shown)", () => {
  it("tier 1 below the standard threshold", () => {
    expect(budgetTierFor(0)).toBe(1);
    expect(budgetTierFor(500_000)).toBe(1);
    expect(budgetTierFor(1_499_999)).toBe(1);
  });
  it("tier 2 at/above standard, below premium", () => {
    expect(budgetTierFor(1_500_000)).toBe(2);
    expect(budgetTierFor(3_499_999)).toBe(2);
  });
  it("tier 3 at/above premium", () => {
    expect(budgetTierFor(3_500_000)).toBe(3);
    expect(budgetTierFor(20_000_000)).toBe(3);
  });
});

describe("gigSpecKeys — derive a gig's specs from category slug + tags", () => {
  it("maps a category slug to its spec key", () => {
    expect(gigSpecKeys("ai-video", [])).toContain("ai_video");
  });
  it("maps tags to spec keys via synonyms", () => {
    const aiVideo = SPECIALIZATIONS.find((s) => s.key === "ai_video")!;
    const syn = aiVideo.synonyms[0]; // a real taxonomy synonym is a valid gig tag
    expect(gigSpecKeys(null, [syn])).toContain("ai_video");
  });
  it("returns empty for an unrelated gig", () => {
    expect(gigSpecKeys("unknown-category", ["nonsense"]).size).toBe(0);
  });
});
