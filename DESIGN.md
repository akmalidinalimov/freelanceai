# Design

Captured from the live code (src/app/globals.css + shipped components), 2026-07-04.

## Theme

Light only — pinned by founder decision (auto-dark palette parked under a never-applied
`.theme-dark` block in globals.css). `html { color-scheme: light }`.

## Color

Tokens are HSL triplets consumed as `hsl(var(--token))` (Tailwind v4 `@theme inline` maps them
to utilities). Canonical values (light):

| Token | Value | Role |
|---|---|---|
| `--background` | `40 33% 98%` | milky warm canvas |
| `--foreground` | `222 24% 14%` | ink |
| `--card` | `40 45% 99.5%` | raised surfaces |
| `--muted-foreground` | `220 12% 40%` | secondary text (≥4.5:1 on bg) |
| `--border` | `36 20% 88%` | hairlines |
| `--input-border` | `214 20% 69%` | form-control borders (non-text contrast) |
| `--primary` | `173 80% 34%` | teal — brand actions |
| `--primary-ink` | `173 84% 21%` | teal for TEXT/links (≈7:1) |
| `--accent` | `11 86% 58%` | coral — energy, CTAs-of-desire |
| `--success` | `152 60% 27%` / `--warning` | `33 95% 33%` | status inks (AA on soft bgs) |
| `--ring` | `173 80% 36%` | focus ring |

Color strategy: **restrained** — milky neutrals + teal/coral accents; the warm color mass
lives in the fixed background layer (Amber Classic), never on content surfaces.

## Signature layers

- **Amber Classic living background** (`living-background/amber-classic.tsx`, mounted in the
  locale layout on every page): drifting dot grid (`.amber-dots`, hsl(18 50% 40%/.14) 1.15px
  @21px) ABOVE three warm morphing washes (terracotta/amber/honey, `amber-morph-a/b`
  keyframes), milk veil `.3`, wide center glow clearing the content column. Fixed, `-z-10`,
  must mount at page root (never inside a positioned section).
- **Prism category tiles** (`prism-category-card.tsx`): shared photograph
  `/prism/pattern-sweep-v2.webp` varied per tile by crop/mirror/hue; zipper type (letters on
  alternating ±0.3em baselines, close on hover); GIGORA pill top, localized pill bottom; film
  grain `.prism-grain` at .14.

## Typography

- **Display**: Unbounded (`--font-display`, `.font-display`), weights 500–800, letter-spacing
  −0.02em. Used for h1/h2/stats/brand moments only.
- **Body**: Manrope (`--font-sans`), 400–800.
- Prices: display face + `tabular-nums`, so'm spelled with small suffix.
- `text-wrap: balance` on hero headings.

## Components & patterns

- Cards: `--radius` 1rem base (`--radius-lg/md/sm` derived), border + `--shadow-soft`,
  hover lifts to `--shadow-hover`. Gig cards use the "browser-chrome" motif (traffic lights +
  gigora.ai/handle address bar).
- Order panel: sticky aside; tier tabs → price → ✓ feature checklist (from
  GigPackage.description "✓ "-lines) → delivery/revisions chips → coral-primary CTA →
  full-width outline Contact button directly beneath → escrow reassurance line.
- Buttons: pill radius, `--primary` filled primary, outline secondary; active scale .97.
- Status chips: soft-tint bg + status ink tokens, always with text label.
- Feature checklists: leading `✓` in `--success`, 13–14px, `space-y-1.5`.

## Motion

- Global reduced-motion kill-switch in globals.css (all animations/transitions).
- Ambient: amber washes 30–38s ease-in-out alternate; dots pan 90s linear.
- Micro: card hover translate/scale ≤300ms; zipper letters 0.55s cubic-bezier(.16,1,.3,1).
- Rule: long calm, one quiet moment; no bounce.

## Layout

- Content column `max-w-5xl`/`max-w-6xl`, px-4; grids `repeat(auto-fit, minmax(...))`.
- 390px is the primary test width; body horizontal scroll is a P0 bug.
- Grid children that contain `overflow-x-auto` tables need `min-w-0`.

## Assets

- `/prism/pattern-sweep-v2.webp` — versioned filename REQUIRED on replacement (4h cache).
- Gig cover fallback = prism photo variant per gig id (never near-invisible gradients).
