# FreelanceAI — Design System & UX Standards

Companion to [BUILD-SPEC.md](BUILD-SPEC.md). The actionable design reference: tokens to
drop into `globals.css`, UX principles, component priorities, and verification.

## North star
> **"A neighbor who happens to run a studio."** Easy as a Telegram message, trustworthy as
> a bank receipt, modern as the AI work being sold.

Three jobs, in order: **(1) make trust legible** (escrow visible at every money moment),
**(2) remove every avoidable decision** (default everything, one primary action per screen),
**(3) show, don't tell** (portfolios/thumbnails are the content; chrome recedes).

## UX principles
- **One filled primary button per screen**; everything else outline/ghost.
- **Telegram-native:** login = the Telegram button; no password mental model; mirror
  notifications to a Telegram bot; short, second-person copy.
- **Money is always explained:** never a bare price next to "Pay" — adjacent escrow + fee line.
- **Thumb-first:** primary actions in the bottom 25% on mobile (sticky bars + bottom tab nav).
- **Progressive disclosure:** 3-step seller wizard, not a 14-field form; packages as 3 cards.
- **Never gate browsing.** Login is summoned **just-in-time** by the first commit/money action,
  with state preserved across the round-trip.
- **Empty states teach** (illustration + one-line + one action) — a confused low-tech user
  reads a blank screen as "broken."

### Onboarding targets
- **Buyer:** browse freely → tap gig → packages + escrow → login at "Continue" → brief → pay.
  Targets: browse→login ≥40%, state preserved 100%.
- **Seller:** login → 3-step wizard (who you are / your gig + samples / pricing template) →
  KYC nudge (deferrable to first sale). Target: live gig < 5 min.

## Design tokens (drop into `src/app/globals.css`)
Extends the current tokens (brand teal `173 80% 36%`, amber accent, radius `0.75rem`).
Keeps the space-separated HSL + `hsl(var(--x))` convention. Adds states, dark mode, semantic
status colors, surfaces, shadows, motion. **Replace Button's `hover:opacity-90` with
`--primary-hover`** (opacity washes out labels).

```css
:root {
  /* surfaces */
  --background:0 0% 100%; --foreground:222 47% 11%;
  --card:0 0% 100%; --card-foreground:222 47% 11%;
  --popover:0 0% 100%; --popover-foreground:222 47% 11%;
  --muted:210 40% 96%; --muted-foreground:215 16% 47%;
  --border:214 32% 91%; --input:214 32% 91%; --ring:173 80% 36%;
  /* brand */
  --primary:173 80% 36%; --primary-foreground:0 0% 100%;
  --primary-hover:173 80% 31%; --primary-muted:173 60% 95%;
  --accent:38 92% 50%; --accent-foreground:222 47% 11%; --accent-muted:38 92% 95%;
  /* status */
  --success:142 71% 38%; --success-foreground:0 0% 100%; --success-muted:142 60% 95%;
  --warning:38 92% 50%; --warning-foreground:28 80% 18%; --warning-muted:38 92% 95%;
  --danger:0 72% 51%; --danger-foreground:0 0% 100%; --danger-muted:0 80% 96%;
  --info:214 90% 52%; --info-foreground:0 0% 100%; --info-muted:214 90% 96%;
  /* trust / rating */
  --trust:173 70% 30%; --rating:38 92% 50%;
  --shadow-color:222 47% 11%; --radius:0.75rem;
}
.dark {
  --background:222 47% 7%; --foreground:210 40% 96%;
  --card:222 40% 10%; --card-foreground:210 40% 96%;
  --popover:222 40% 10%; --popover-foreground:210 40% 96%;
  --muted:217 33% 16%; --muted-foreground:215 20% 65%;
  --border:217 33% 20%; --input:217 33% 22%; --ring:173 70% 45%;
  --primary:173 70% 45%; --primary-foreground:222 47% 7%;
  --primary-hover:173 70% 52%; --primary-muted:173 40% 18%;
  --accent:38 92% 55%; --accent-foreground:222 47% 7%; --accent-muted:38 40% 18%;
  --success:142 65% 45%; --success-muted:142 40% 15%;
  --warning:38 92% 55%; --warning-muted:38 40% 16%;
  --danger:0 72% 58%; --danger-muted:0 40% 18%;
  --info:214 90% 60%; --info-muted:214 40% 18%;
  --trust:173 65% 50%; --shadow-color:0 0% 0%;
}
```
Map the new colors in `@theme inline` (so `bg-success`, `text-trust` work), add radii
(`sm 8 / md 10 / lg 12 / xl 18 / 2xl 24`), shadows (`xs→lg` + focus ring `0 0 0 3px hsl(var(--ring)/.35)`),
and motion tokens (`--ease-out: cubic-bezier(.16,1,.3,1)`, `--dur-fast 120ms / base 200ms / slow 320ms`).
Dark mode = `.dark` class on `<html>` from a cookie (no flash). Standardize components on Tailwind
color utilities (`bg-primary`) rather than inline `hsl(var(--…))` strings.

## Typography
- **Body/UI: Inter** (Latin + latin-ext + Cyrillic subset); **Display: Manrope** (headings only,
  marketing routes); **fallback: Noto Sans**. Self-host via `next/font`, `display:swap` (slow CA
  mobile networks — no Google round-trip). Must render Uzbek `oʻ gʻ ʻ` (U+02BB) and Cyrillic.
- Scale (mobile base **16px**, never <16px on inputs → no iOS zoom): display 36→48/800, h1 28/700,
  h2 22/700, h3 18/600, base 16/400, sm 14, xs 12; **price 18/700 `tabular-nums`**.
- i18n: `text-wrap:balance` headings, `pretty` body; never truncate prices/status; **RU/UZ run
  15–35% longer than EN** — size to content, test the longest locale.

## Layout & touch
- Mobile-first, **design at 360px**. Breakpoints sm640/md768/lg1024/xl1280. Container `max-w-6xl`
  (content) / `max-w-3xl` (forms). Touch targets ≥44px (primary 48px), ≥8px apart. Icons: **Lucide** only.

## Component inventory (priority = build order)
Button (extend: add `loading/accent/destructive/success/icon/full`, token hover, focus ring) ·
Header+nav (desktop search bar; **mobile bottom tab bar** Home/Search/Orders/Messages/Profile, badges) ·
**Gig card** (16:9 lazy media, seller row, 2-line title, rating, "from X so'm" + delivery chip, skeleton) ·
Gig detail (gallery, sticky bottom action bar, package selector, trust block) · Package selector
(3 segmented tabs, "Popular" ring) · Seller profile (languages spoken = critical) · Portfolio gallery
(lightbox) · Search + filter **bottom sheet** + chips · Order flow (brief → review, autosave) ·
**Checkout** (Payme/Click cards, escrow reassurance, UZS breakdown, "don't close" PSP guard,
safe-failure copy) · **Chat** (Telegram-style bubbles, delivery bubble with Accept/Revision, optimistic) ·
Reviews (star + sub-criteria, distribution) · Dashboards (buyer/seller/admin; seller shows held vs
available) · **States: skeleton/empty/error first-class** · Toasts (`aria-live`) · Modals = **bottom
sheets** on mobile. Document every component in light+dark+uz/ru/en.

## Animation
**CSS/Tailwind transitions for ~90% (state/hover/sheet/toast/skeleton); GSAP for the few orchestrated
moments (onboarding reveal, order-delivered/escrow-release celebration). Do NOT add Framer Motion**
(forces client components, ~30–50KB, fights RSC). Wrap only the animated leaf in a `"use client"`
component using `useGSAP()`; never gate content visibility on JS. **Do not animate** route transitions,
prices/money, or anything in lists. Honor `prefers-reduced-motion` (global override + GSAP `matchMedia`);
default to calm, short, `ease-out`.

## CSS architecture
Single token source in `globals.css` → `@theme`; variants via `cva` + `cn()`; no raw hex/per-component
colors. **RTL-safe from day one**: logical properties only (`ms/me/ps/pe`, `start/end`, `text-start`) —
no `ml/mr/left/right` for flow; `dir` on `<html>` from locale; direction-icons flip with
`[dir=rtl]:-scale-x-100`. uz **Cyrillic = script preference** (cookie `uz_script`) inside the uz locale,
not a 4th route. Pseudo-localize in dev (+40%) to catch overflow.

## Accessibility / performance / i18n budgets
- **WCAG AA:** contrast ≥4.5:1 (3:1 UI) both themes; semantic HTML; full keyboard + visible focus;
  focus trap+restore in sheets; labelled inputs + `aria-describedby` errors; status never color-only;
  `alt` on media; `lang`/`dir` per locale; `aria-live` toasts/chat/order-status.
- **Perf (mid-tier Android/4G):** LCP <2.5s, CLS <0.05, INP <200ms, TTFB <0.8s, initial JS <130KB on
  marketplace routes, ≤1 variable woff2 subset, `next/image` AVIF/WebP + blur + reserved aspect ratios.
- **i18n:** locale-prefixed static routes; infer first-visit locale (Accept-Language + Telegram
  `language_code`); all copy in `messages/*`; **ICU plurals** (uz/ru differ from en); UZS via formatters.

## Verification checklist (per area)
- **Trust/money:** every price has escrow/fee line; escrow on gig/checkout/tracker/balance; payment-fail
  copy reassures no money taken; "held vs available" understood by 3 test sellers.
- **Ease:** one primary button/screen (visual audit, all locales); browsing never gated; login state
  survives round-trip; 5 users complete buyer-order & seller-publish unaided on their phones.
- **Mobile/multilingual:** designed/tested at 360px; bottom thumb-zone actions; every screen in
  uz/ru/en + uz-Cyrillic with no overflow; plurals/currency correct.
- **System/dark/motion:** all via tokens; `/_dev/tokens` renders; both themes pass contrast; inputs
  ≥16px; Uzbek/Cyrillic no `.notdef`; reduced-motion honored; Framer Motion not shipped; 60fps on throttled Android.
- **A11y/perf:** axe/Lighthouse ≥90 both themes; keyboard run of order + seller flows; TalkBack/VoiceOver
  on 4 core screens; LCP/CLS/INP within budget; 0 skeleton→loaded shift.
- **RTL-readiness:** logical-properties grep clean; `dir=rtl` dev flip mirrors layout/chat/nav.

## Riskiest assumption (validate early)
Central Asian buyers must trust an unfamiliar platform enough to **pre-pay strangers via Payme/Click**.
Validate cheaply: (1) escrow comprehension test — ≥80% can say "money held until delivery" in their own
words; (2) concierge pilot with human-mediated escrow, measure real pre-pay completion; (3) A/B
escrow-prominent vs minimal checkout. Secondary: poll uz Latin vs Cyrillic preference (may make the
script toggle launch-blocking).
