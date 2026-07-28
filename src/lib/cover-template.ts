/**
 * Branded gig-cover TEMPLATE — pure string building, no server dependency, so it is
 * unit-testable and safe to import anywhere. The render + upload half lives in
 * server/services/cover-template.ts.
 *
 * NOT an AI image model: this draws the Gigora recipe (Sandstone ground, dot grid,
 * category-tinted wash, orange spine, wordmark, title) as SVG for sharp to rasterize.
 * Free, ~250ms, and identical layout across every gig so the marketplace reads as one
 * designed system.
 */
import { formatUzs } from "@/lib/utils";

export interface CoverSpec {
  title: string;
  categoryLabel?: string;
  categorySlug?: string;
  sellerName?: string;
  username?: string | null;
  priceUzs?: number;
}

const W = 1600;
const H = 900;
const PRIMARY = "#EA580C"; // --primary
const SAND = "#f3f1ec"; // --background (Sandstone Weave)
const INK = "#1d1d1f"; // --foreground

/** Category → accent hue, so each category reads differently while the layout stays fixed. */
const HUE_BY_CATEGORY: Record<string, number> = {
  "ai-video": 265,
  "ai-image": 288,
  "ai-avatar": 200,
  "ai-product": 32,
  "ai-ads": 21,
  branding: 21,
  voiceover: 172,
  motion: 250,
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Wrap a title onto at most two lines, preferring whole words. */
function wrapTitle(title: string, max = 20): string[] {
  const words = title.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= max) cur = (cur + " " + w).trim();
    else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === 2) break;
    }
  }
  if (cur && lines.length < 2) lines.push(cur);
  const out = lines.slice(0, 2);
  // Signal truncation rather than silently dropping words.
  if (out.join(" ").length < title.trim().length && out.length === 2) out[1] = out[1] + "…";
  return out;
}

export interface CoverSpec {
  title: string;
  categoryLabel?: string;
  categorySlug?: string;
  sellerName?: string;
  username?: string | null;
  priceUzs?: number;
}

export function buildCoverSvg(spec: CoverSpec): string {
  const hue = HUE_BY_CATEGORY[spec.categorySlug ?? ""] ?? 21;
  const [l1, l2] = wrapTitle(spec.title);
  const twoLine = Boolean(l2);
  const byline = [spec.sellerName, spec.username ? `@${spec.username}` : null].filter(Boolean).join(" · ");
  const price = spec.priceUzs ? `${formatUzs(spec.priceUzs)} so'm dan` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 90% 52%)" stop-opacity="0.17"/>
      <stop offset="100%" stop-color="hsl(${hue + 18} 88% 48%)" stop-opacity="0.05"/>
    </linearGradient>
    <radialGradient id="glow" cx="78%" cy="28%" r="55%">
      <stop offset="0%" stop-color="hsl(${hue} 92% 55%)" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="hsl(${hue} 92% 55%)" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.6" fill="${INK}" fill-opacity="0.07"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="${SAND}"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <rect width="${W}" height="${H}" fill="url(#wash)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="0" width="14" height="${H}" fill="${PRIMARY}"/>
  <circle cx="96" cy="92" r="11" fill="${PRIMARY}"/>
  <text x="124" y="103" font-family="Unbounded" font-size="34" font-weight="800" fill="${INK}">Gigora</text>
  ${
    spec.categoryLabel
      ? `<text x="96" y="300" font-family="Manrope" font-size="30" font-weight="700" fill="${PRIMARY}" letter-spacing="3">${esc(
          spec.categoryLabel.toUpperCase()
        )}</text>`
      : ""
  }
  <text x="96" y="400" font-family="Unbounded" font-size="80" font-weight="800" fill="${INK}">${esc(l1 ?? "")}</text>
  ${twoLine ? `<text x="96" y="496" font-family="Unbounded" font-size="80" font-weight="800" fill="${INK}">${esc(l2)}</text>` : ""}
  <rect x="96" y="${twoLine ? 556 : 460}" width="120" height="6" rx="3" fill="${PRIMARY}"/>
  ${byline ? `<text x="96" y="${twoLine ? 652 : 556}" font-family="Manrope" font-size="34" fill="${INK}" fill-opacity="0.72">${esc(byline)}</text>` : ""}
  ${price ? `<text x="96" y="${H - 68}" font-family="Manrope" font-size="36" font-weight="700" fill="${INK}">${esc(price)}</text>` : ""}
</svg>`;
}

