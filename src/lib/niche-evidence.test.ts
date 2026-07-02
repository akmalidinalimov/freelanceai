import { describe, it, expect } from "vitest";
import { computeSpecEvidence } from "./niche-evidence";

describe("niche evidence — anti-gaming proof tiers", () => {
  it("marks a spec PROVEN only from delivered (completed-order) categories", () => {
    const e = computeSpecEvidence({
      declared: ["ai_video"],
      gigTags: [],
      gigCategorySlugs: [],
      orderCategorySlugs: ["ai-video"],
    }).get("ai_video")!;
    expect(e.proven).toBe(true);
    expect(e.supported).toBe(false);
  });

  it("tag-only / gig-only evidence is SUPPORTED, never proven (keyword-stuffing guard)", () => {
    const e = computeSpecEvidence({
      declared: ["fashion"],
      gigTags: ["fashion", "moda"], // self-authored, editable after moderation
      gigCategorySlugs: [],
      orderCategorySlugs: [],
    }).get("fashion")!;
    expect(e.fromGigs).toBeGreaterThan(0);
    expect(e.proven).toBe(false); // <- the fix: tags alone don't earn the ✓ / +0.5 boost
    expect(e.supported).toBe(true);
  });

  it("a bare declaration is neither proven nor supported", () => {
    const e = computeSpecEvidence({
      declared: ["gaming"],
      gigTags: [],
      gigCategorySlugs: [],
      orderCategorySlugs: [],
    }).get("gaming")!;
    expect(e.declared).toBe(true);
    expect(e.proven).toBe(false);
    expect(e.supported).toBe(false);
  });
});
