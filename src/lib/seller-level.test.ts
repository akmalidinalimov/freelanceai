import { describe, it, expect } from "vitest";
import { computeSellerLevel } from "./seller-level";

describe("computeSellerLevel", () => {
  it("starts at NEW", () => {
    expect(computeSellerLevel(0, 0, 0)).toBe("NEW");
    expect(computeSellerLevel(1, 5, 1)).toBe("NEW"); // needs 2 completed for L1
  });

  it("LEVEL_1 at 2+ completed with rating ≥4", () => {
    expect(computeSellerLevel(2, 4.0, 2)).toBe("LEVEL_1");
    expect(computeSellerLevel(5, 3.9, 3)).toBe("NEW"); // rating too low
  });

  it("LEVEL_2 at 10+ completed, 5+ reviews, rating ≥4.5", () => {
    expect(computeSellerLevel(10, 4.5, 5)).toBe("LEVEL_2");
    expect(computeSellerLevel(10, 4.4, 5)).toBe("LEVEL_1");
  });

  it("TOP_RATED at 50+ completed, 30+ reviews, rating ≥4.8", () => {
    expect(computeSellerLevel(50, 4.8, 30)).toBe("TOP_RATED");
    expect(computeSellerLevel(50, 4.8, 29)).toBe("LEVEL_2"); // not enough reviews
  });

  it("is monotonic-ish: higher stats never demote below a met tier", () => {
    expect(computeSellerLevel(100, 5, 100)).toBe("TOP_RATED");
  });
});
