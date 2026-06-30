import { describe, it, expect } from "vitest";
import { approxUsd, approxRub, approxPrice } from "./currency";

describe("approximate currency display", () => {
  it("converts UZS to approx USD/RUB at the default rates", () => {
    expect(approxUsd(126_000)).toBe(10); // 126000 / 12600
    expect(approxRub(13_500)).toBe(100); // 13500 / 135
  });

  it("formats a compact dual-currency hint", () => {
    const s = approxPrice(126_000);
    expect(s).toContain("$10");
    expect(s).toContain("₽");
  });
});
