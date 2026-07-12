/**
 * Per-gig visual variation for cover images.
 *
 * Covers are seeded per-CATEGORY (`/covers/{cat}.png`), so without variation
 * every gig in a category — and every same-category "related" card — renders the
 * IDENTICAL photograph (critique 2026-07-04: "one photograph everywhere; the
 * signature moment becomes wallpaper"). Hashing the gig id into a crop + mirror
 * (and, for the abstract prism fallback only, a hue shift) makes same-category
 * tiles read as distinct without needing a unique asset per gig.
 *
 * `hue` is applied ONLY to the abstract prism fallback — never to real photos,
 * where a hue-rotate would wreck skin tones and brand colors.
 */
export function coverVariant(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const pos = ["50% 30%", "50% 50%", "50% 70%", "38% 45%", "62% 45%"] as const;
  const hues = [0, 14, -16, 26, -8] as const;
  return {
    flip: h % 2 === 1,
    pos: pos[h % pos.length],
    hue: hues[Math.floor(h / 2) % hues.length],
  };
}
