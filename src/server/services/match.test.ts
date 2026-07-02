import { describe, it, expect } from "vitest";
import { parseIntent } from "./match";

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
