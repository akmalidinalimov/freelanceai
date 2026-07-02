# UI Sprint 1 — Light-first redesign + living background + Instagram showcase

REVISED 2026-07-02 (supersedes the dark-only brief). Direction from the founder:

- DEFAULT THEME: **light**, minimalistic, warm, premium — NOT dark.
- **Living background**: the site must feel alive — an animated warm gradient /
  ambient motion layer. Team builds THREE candidate concepts on the homepage
  hero (§Task 2 of the prompt); the founder picks one, it then rolls out.
- DARK THEME: automatic only, via `prefers-color-scheme` (phone in dark mode →
  site in dark mode). No manual toggle in v1. Light is the canonical design;
  dark is a faithful translation of it.
- UX bar: "every button, every card" — full interaction-state coverage
  (hover/active/focus/disabled/loading), micro-interactions with taste,
  one-primary-action-per-screen simplicity.

Task list (one branch each, `feature/redesign-<n>`):
1. Design-system foundation: light tokens + auto-dark set + interaction primitives
2. Living-background lab — build 3 concepts, founder picks
3. Homepage restyle (light minimal + chosen living background)
4. Marketplace + browse + creators pass
5. Instagram auto-looping showcase on public profiles
6. Gig detail upgrade (lightbox, sticky panel, comparison, FAQ)
7. Skeletons + designed empty states
8. Dashboards visual refresh
9. Order status timeline stepper
10. Toast/dialog system + micro-interaction pass
11. Final audit — BOTH themes, mobile, contrast, reduced-motion

Every task verifies in BOTH themes before push. Full detail lives in the
founder's prompt (2026-07-02, revised). Workflow contract: CONTRIBUTING.md.
