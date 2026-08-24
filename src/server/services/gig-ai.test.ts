import { describe, it, expect } from "vitest";
import { clampGigDraft, templateGigDraft, type GigDraft, type GigDraftInput } from "./gig-ai";

/**
 * Guardrail tests for the AI gig drafter. The model output is untrusted; clampGigDraft must
 * always yield a valid, consistent draft — exactly 3 monotonically-priced tiers, prices ≥ 1000,
 * days ≥ 1 — even from garbage, so a bad generation can never produce an invalid gig.
 */
const input: GigDraftInput = { service: "logo dizayn", deliverable: "3 ta logo varianti", days: 3, priceUzs: 50_000 };

describe("clampGigDraft (untrusted-output guardrail)", () => {
  it("synthesizes a valid 3-tier ladder from null (the no-AI template)", () => {
    const d = templateGigDraft(input);
    expect(d.packages.map((p) => p.tier)).toEqual(["BASIC", "STANDARD", "PREMIUM"]);
    expect(d.packages[0].priceUzs).toBe(50_000);
    // strictly increasing price
    expect(d.packages[1].priceUzs).toBeGreaterThan(d.packages[0].priceUzs);
    expect(d.packages[2].priceUzs).toBeGreaterThan(d.packages[1].priceUzs);
    expect(d.packages.every((p) => p.deliveryDays >= 1)).toBe(true);
    expect(d.title).toBe("logo dizayn");
    expect(d.description).toBe("3 ta logo varianti");
  });

  it("repairs garbage model output (non-monotonic prices, junk fields, too many tags/extras)", () => {
    const raw = {
      title: "x".repeat(500),
      description: "d",
      tags: Array.from({ length: 40 }, (_, i) => `TAG${i % 3}`), // dupes + too many + uppercase
      packages: [
        { tier: "BASIC", title: "B", priceUzs: 90_000, deliveryDays: 2, revisions: 1 },
        { tier: "STANDARD", title: "S", priceUzs: 10, deliveryDays: 0, revisions: 2 }, // lower than basic + bad days
        { tier: "PREMIUM", title: "P", priceUzs: 5, deliveryDays: 1, revisions: 99 },
      ],
      extras: Array.from({ length: 20 }, () => ({ title: "extra", priceUzs: 100 })),
      requirementPrompts: ["q1", "", "q2"],
    } as unknown as Partial<GigDraft>;
    const d = clampGigDraft(raw, input);

    expect(d.title.length).toBeLessThanOrEqual(80);
    // prices strictly increase despite the model returning descending values
    expect(d.packages[1].priceUzs).toBeGreaterThan(d.packages[0].priceUzs);
    expect(d.packages[2].priceUzs).toBeGreaterThan(d.packages[1].priceUzs);
    expect(d.packages.every((p) => p.priceUzs >= 1000 && p.deliveryDays >= 1)).toBe(true);
    expect(d.tags.length).toBeLessThanOrEqual(10);
    expect(new Set(d.tags).size).toBe(d.tags.length); // deduped
    expect(d.tags.every((t) => t === t.toLowerCase())).toBe(true);
    expect(d.extras.length).toBeLessThanOrEqual(6);
    expect(d.requirementPrompts).toEqual(["q1", "q2"]); // empties dropped
  });

  it("never drops below the price/day floors even with tiny inputs", () => {
    const d = clampGigDraft(null, { service: "s", deliverable: "x", days: 0, priceUzs: 1 });
    expect(d.packages.every((p) => p.priceUzs >= 1000 && p.deliveryDays >= 1)).toBe(true);
  });
});
