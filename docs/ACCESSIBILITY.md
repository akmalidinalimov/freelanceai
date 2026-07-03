# Accessibility baseline (WCAG 2.1 AA)

Gigora targets **WCAG 2.1 AA**. This is the living checklist every UI change is held
to. It was established by a four-dimension audit (forms, keyboard, structure,
contrast) and remediated across commits `ee16b7d`, `7e558b1`, `800d481` (2026-07).

When you add or change a UI surface, match the patterns below. They are not
aspirational — they reflect what the codebase already does; keep it consistent.

---

## Token contract (contrast)

Colors live in [`src/app/globals.css`](../src/app/globals.css). Three tokens exist
specifically to hold AA contrast — **do not "simplify" them back into their siblings**:

| Token | Value | Why it exists |
|---|---|---|
| `--muted-foreground` | `215 20% 40%` | Secondary text. Darkened from 47%→40% L so it clears **4.5:1** on the `--muted` panel bg, not just on white. Don't lighten it. |
| `--primary-ink` | `173 84% 21%` | Teal for **text on light** only (`text-[hsl(var(--primary-ink))]`). The brand `--primary` (`173 80% 36%`, teal `#12A594`) is **3.07:1** as text — fails AA. Fills/buttons/borders keep `--primary`; text uses `--primary-ink`. |
| `--input-border` | `214 20% 69%` | Form-field boundary (`border-[hsl(var(--input-border))]`). Clears **3:1** non-text contrast (1.4.11). The decorative `--border` (`214 32% 91%`, ~1.24:1) is fine on cards but too light for an input edge. |
| `--ring` | `173 80% 36%` | Focus ring for inputs that opt out of the default outline via `focus-visible:ring-[hsl(var(--ring))]`. Must stay defined or those rings go invisible. |

Also global in `globals.css`: `:focus-visible { outline: 2px solid … }` (keyboard
focus for everything) and `::placeholder { color: hsl(var(--muted-foreground)) }`
(don't rely on the browser default grey — it fails 4.5:1).

**Rules of thumb**
- Teal **text** → `--primary-ink`. Teal **fill/border/gradient** → `--primary`.
- Form-field border → `--input-border`. Card/divider border → `--border`.
- Error text → `text-red-700` (6.5:1). Success text → `text-emerald-700` / `text-green-800`.
- Any new color-on-color combo: check ≥4.5:1 (normal text), ≥3:1 (large ≥18px/bold, and non-text/UI boundaries).

**Deliberately NOT done** (whole-identity shifts — founder decision, not defects):
darkening the teal **fills** globally, and heavier **card/divider** borders. Don't
"fix" these as if they were bugs.

---

## Required patterns

### Forms (3.3.2 / 4.1.2)
- Every `<input>`/`<textarea>`/`<select>` needs a programmatic name. A `placeholder`
  is **not** a label. Idiom here: `aria-label={<same expr as the placeholder>}`
  (reuse the existing i18n key — don't invent one).
- Group single-choice/related controls: `role="group"` + an `aria-label`, and expose
  selected state with `aria-pressed` (see the tier selector / star rating / extras in
  [`order-panel.tsx`](../src/components/order-panel.tsx), [`review-form.tsx`](../src/components/review-form.tsx)).

### Status messaging (4.1.3)
- Async **error** text → `role="alert"`. Async **success/"saved"/"sent"** text →
  `role="status"`. A `<p>{error}</p>` that appears after a fetch but has no role is
  invisible to screen readers.

### Live / real-time surfaces (4.1.3)
- Anything that updates the DOM without a navigation must announce it:
  - Message thread (SSE/poll) → `aria-live="polite"` on the message container.
  - Search results / async panels → `aria-live` + `aria-busy` while loading.
  - Optimistic list mutations (notifications) → `aria-live` on the `<ul>`.
  - Polled counters (unread bell) → a visually-hidden `aria-live` companion.
  - Purely decorative motion (activity ticker) → `aria-hidden="true"`.

### Keyboard (2.1.1 / 2.4.3 / 2.4.7)
- No `onClick` on a `<div>`/`<span>` without `role="button"` + `tabIndex={0}` +
  an Enter/Space `onKeyDown` (preventDefault on Space). Prefer a real `<button>`.
- Overlays/menus close on **Escape** and restore focus to the trigger
  (see [`mobile-menu.tsx`](../src/components/mobile-menu.tsx)).
- Never `outline-none` without a visible replacement (`focus-visible:ring-…`).

### Icons & images
- Icon-only buttons/links (×, +, ▶, ♥, →, 🎙, ℹ️) need an `aria-label`.
  Decorative glyphs get `aria-hidden`.
- Informative `<img>` → meaningful `alt`. Decorative (avatars where the name is
  adjacent, gradient placeholders) → `alt=""` (present, empty — never missing).

### Structure
- One logical `<h1>` per page; no skipped levels (h1→h2→h3).
- Card grids that are a list of results/items use `<ul>`/`<li>`. If cards rely on
  grid equal-height, give the card root `h-full` so the `<li>` wrapper doesn't break it.
- Keep `<html lang={locale}>`, the skip-link → `#main`, and the landmark set
  (`header`/`nav`/`main`/`footer`) intact — they already exist in the root layout.

---

## How to re-audit

- **Automated (in prod verify):** the post-deploy suite checks the skip-target/`main`
  landmark and security headers. Keep those green.
- **On-demand deep audit:** re-run the four-dimension pass (forms, keyboard,
  structure, contrast) over changed files — the method that produced this baseline.
  Cite `file:line` + WCAG SC + a concrete fix; verify each finding against the actual
  code before acting (many controls are already compliant).
- **Quick local checks:** `text-[hsl(var(--primary))]` used as a text color (should be
  `--primary-ink`); `<input>`/`<textarea>` with a `placeholder` but no `aria-label`;
  `<p>{error}` / `<p>{...saved}` with no `role`.
