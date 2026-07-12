# Redesign — Final Audit (Task 11)

Scope: every restyled surface (home, /gigs, gig detail, /browse, /creators,
profile incl. IG strip, /search, both dashboards, order page, settings,
messages) in **light and dark**.

> **Important:** the live full-app render can't run on the dev machine — `main`'s
> schema now requires the `pgvector` Postgres extension, which the local embedded
> Postgres can't provide, so server pages don't render here. Everything below is a
> **code-level** audit. The items under "Must verify on staging" need a running
> app (staging has pgvector) and the founder's visual pass, which is how QA was
> agreed for this sprint.

## Verified in code ✅

**Reduced motion** — every animated surface has a fallback:
- Living background (all 3 concepts): `@media (prefers-reduced-motion)` freezes
  the blobs / the JS concepts early-return before adding listeners.
- Activity ticker & IG showcase marquees: the global reduced-motion rule stops
  the loop; the IG showcase also flips to a static scrollable row (`animate=false`).
- Skeleton shimmer, toast entrance (`motion-safe:`), order-timeline current-step
  ping — all collapse to static under the global rule.

**Both-theme correctness** — no per-component color literals remain (Task 1b sweep,
0 residuals); every surface consumes tokens, and both palettes + all semantic tokens
are present in the compiled CSS. Status chips use soft-tint + colored-ink tokens
(readable in both themes) and always keep their text label.

**Focus / keyboard**:
- MediaLightbox + ConfirmDialog: `role`/`aria-modal`, focus trapped, focus
  returned to trigger on close, Esc + backdrop cancel.
- Global `:focus-visible` ring (token `--ring`) with offset works in both themes.

**Landmarks / alt**: one `<h1>` per page (checked); decorative images use `alt=""`;
gallery/showcase/lightbox images carry captions or empty alt; moving marquee clones
are `aria-hidden` + `tabindex=-1` (IG showcase).

**Layout**: image/media boxes reserve aspect (`aspect-video`/`aspect-[4/5]`, explicit
tile dims) → no CLS; horizontal strips use `overflow-x-auto` inside their own box
(no body horizontal scroll introduced).

## Must verify on staging (needs the running app) 🔍
1. **Contrast with a real checker**, both themes: body ≥4.5:1, large ≥3:1,
   placeholders, status chips, and **text over the living background at its
   lightest/warmest frame**. Fix at the token level if anything misses.
2. **390px pass**: no body horizontal scroll on any page; sticky order-panel offset
   vs. header; the mobile Filters bottom sheet + the media lightbox usable; bottom-nav
   safe-area inset.
3. **Tap targets ≥44px** on mobile — audit the small icon buttons (e.g. `save-heart`
   is a 32px overlay; mobile filter/submit buttons are 40px). Bump where a real
   device shows them too small.
4. **Theme flip mid-session** (`prefers-color-scheme`): no stuck colors; check any
   image/logo that assumes a light backdrop.
5. **Keyboard walk**: home → search → gig → order, and dashboard → order → chat;
   visible focus throughout; lightbox/dialog traps hold.

## Consciously deferred (flagged in their task commits)
- Task 6: mobile bottom order-bar + deeper `OrderPanel` restyle (kept minimal — the
  ordering flow shouldn't be restyled blind).
- Task 7: remaining empty states (saved gigs, own portfolio, search, orders).
- Task 10: mount `<UIProviders>` in the layout (platform request in UI-REQUESTS.md);
  replace the remaining 4 `window.confirm` sites; wire success/error toasts across
  forms once the provider is mounted.
- Living-background: founder still to pick 1/2/3 (default is Concept 1).

## Merge order
Branches are stacked: **1 → 1b → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11**. Merge in
that order for a clean history; this audit branch (`redesign-11`) adds only these notes.
