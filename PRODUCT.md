# Product

## Register

product

## Users

- **Buyers**: Uzbek small-business owners and marketers (fashion, cosmetics, food, e-commerce) who need creative assets (video ads, product photos, branding) but have never hired online. Mostly on phones, live in Telegram, price-aware, **trust is their #1 barrier** — they fear paying a stranger online.
- **Creators**: young Uzbek AI-native creatives (Runway/Midjourney/HeyGen users) monetizing their skills locally instead of competing on global platforms. They market themselves on Instagram and want a professional storefront (`gigora.ai/@username`).
- Context: trilingual (uz primary, ru, en), Uzbekistan-first, Telegram-native auth and notifications, payments via Payme/Click/Uzum.

## Product Purpose

Gigora is Central Asia's AI-creative marketplace: describe a job in plain words, the AI matches the best local creators, escrow-style payment protection holds funds until work is accepted. Success = a first-time buyer completes an order without fear, and a creator earns real income from their Instagram audience.

## Brand Personality

**Warm · Trustworthy · Playfully-creative.** The core feeling is a bright, cozy, premium home ("white background is what keeps people trusting" — founder), carried with young creator energy: prism light, playful motion moments, confident type. Voice: friendly-expert Uzbek, never corporate, never hype.

## Anti-references

- **Generic Fiverr clone**: dense green-white listing grids, cluttered seller cards, stock-photo energy.
- **Cheap classifieds board** (OLX/avito visual chaos): low-trust, ad-heavy, no curation feeling.
- **Corporate bank sterility**: over-formal, cold, personality-free.
- (Soft anti: dark-techy AI clichés — the founder explicitly pinned the light theme; charcoal + neon is off-brand.)

## Design Principles

1. **Trust is the design brief.** Every money-adjacent surface (gig page, order, checkout) must visibly answer "is my money safe?" — escrow messaging, verified badges, seller identity at the decision point.
2. **Content on milk, color at the edges.** Text and cards float on clean milky white; the warm living background (Amber Classic washes + dot grid) breathes at the margins and never covers content.
3. **One signature moment per surface, everything else quiet.** Prism tiles, zipper type, the living background — spend boldness once; restraint everywhere else is what reads premium.
4. **The AI shows itself working.** Matching, ranking, "why matched" — the product's magic should be visible (typewriter briefs, match explanations), not claimed.
5. **Phone-first, Uzbek-first.** 390px is the primary canvas; uz copy is written first, never translated last.

## Accessibility & Inclusion

- WCAG 2.1 AA baseline (documented in docs/ACCESSIBILITY.md): body text ≥4.5:1, non-text ≥3:1, contrast token contract (`--primary-ink`, `--input-border`, darkened `--success`/`--warning`).
- Reduced-motion fallback on every animation (global rule in globals.css).
- Tap targets ≥44px on primary controls; visible `:focus-visible` ring; skip-link; one h1 per page.
- Trilingual parity: uz/ru/en message catalogs are additive-only and complete.
