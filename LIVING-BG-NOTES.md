# Living Background Lab — 3 concepts (Task 2)

Compare live on the homepage hero: `/uz?bg=1`, `/uz?bg=2`, `/uz?bg=3`
(default with no param = concept 1). A small corner label shows which is active.
**The founder picks the winner** — it then becomes a reusable component (hero
prominent, whisper-subtle page-wide) in Task 3.

All three share: `pointer-events:none` + `aria-hidden`; a token-driven veil/scrim
so foreground text sits on a near-solid surface (contrast unchanged vs. plain
background, both themes); reduced-motion → fully static; zero layout shift; zero
horizontal overflow; dark mode = embers (warm stops dim via `--gradient-*` tokens
and/or the dark veil).

| | **1 · Breathing Aurora** | **2 · Ambient Film** | **3 · Responsive Dawn** |
|---|---|---|---|
| Technique | Pure CSS radial blobs, transform/scale drift | Looping video under a scrim (gradient poster fallback) | CSS gradient drift + damped pointer/scroll lean + time-of-day palette |
| JS shipped | **0 bytes** | ~0.6 KB (lazy-mount gate) | ~0.9 KB (rAF listener) |
| CPU (idle) | ~0% (compositor-only transforms) | video decode while playing (moderate); 0% before mount / on fallback | ~0% idle; brief rAF only while pointer/scroll moves (desktop) |
| LCP impact | none (paints with page, no network) | none if lazy-mounted correctly; the **video file** is the risk → gated off on mobile/save-data/reduced-motion | none (text SSRs; effect hydrates after) |
| Mobile | full effect, cheap | **poster/gradient only** (video skipped) | autonomous drift only (no pointer/scroll) |
| Asset needed | none | **yes — a licensed <4 MB muted loop** (not yet wired; renders as the gradient prototype until provided) | none |
| Risk | essentially none | asset sourcing + licensing + decode cost on low-end Android | slightly more logic; heavily damped so it stays ambient, not a toy |

## Notes / honesty
- **Concept 2 has no real video yet.** The component is complete (correct
  `autoPlay muted loop playsInline poster preload=none`, lazy-mount after first
  paint, skipped on reduced-motion / save-data / small screens). Pass a `src`
  once you approve a royalty-free abstract loop; record its license here and in
  the PR before it ships. Until then `?bg=2` shows the animated warm gradient so
  it can still be compared.
- CPU/LCP figures above are engineering estimates — please confirm with your own
  DevTools (Performance + Lighthouse) on a mid-range Android, which is the bar
  the brief sets.

## Our recommendation
**Concept 1 (Breathing Aurora)** as the default: zero JS, zero LCP risk, cannot
warm a low-end phone, and reads as calm-premium in both themes — ideal for the
"prominent in hero, whisper-subtle page-wide" rollout. If you want the hero to
feel a touch more interactive, **Concept 3** is the upgrade (its time-of-day
shift is a lovely detail) at a small, contained cost. **Concept 2** only if you
have a genuinely beautiful, well-licensed loop and accept the mobile/decode
trade-offs — otherwise its gradient fallback is just a heavier Concept 1.
