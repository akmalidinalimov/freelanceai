import { describe, it, expect } from "vitest";
import { buildCoverSvg } from "./cover-template";

const base = { title: "Logotip dizayn", sellerName: "Aziza", username: "aziza" };

describe("buildCoverSvg", () => {
  it("renders a 16:9 canvas with the brand ground and wordmark", () => {
    const svg = buildCoverSvg(base);
    expect(svg).toContain('width="1600"');
    expect(svg).toContain('height="900"');
    expect(svg).toContain("#f3f1ec"); // Sandstone background token
    expect(svg).toContain(">Gigora<");
  });

  it("tints by category and falls back to brand orange for unknown slugs", () => {
    expect(buildCoverSvg({ ...base, categorySlug: "voiceover" })).toContain("hsl(172");
    expect(buildCoverSvg({ ...base, categorySlug: "ai-video" })).toContain("hsl(265");
    expect(buildCoverSvg({ ...base, categorySlug: "nope" })).toContain("hsl(21");
  });

  it("wraps a long title onto two lines and marks truncation", () => {
    const svg = buildCoverSvg({
      ...base,
      title: "Juda uzun sarlavha bu yerda davom etadi va yana davom etadi tugamaydi",
    });
    // Two title <text> nodes at the display size, and the second ends with an ellipsis.
    const titles = svg.match(/font-size="80"/g) ?? [];
    expect(titles.length).toBe(2);
    expect(svg).toContain("…");
  });

  it("escapes markup so a crafted title cannot inject SVG", () => {
    const svg = buildCoverSvg({ ...base, title: '<script>x</script>' });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("omits the price line when no price is given", () => {
    expect(buildCoverSvg(base)).not.toContain("so'm dan");
    expect(buildCoverSvg({ ...base, priceUzs: 50000 })).toContain("so'm dan");
  });
});
