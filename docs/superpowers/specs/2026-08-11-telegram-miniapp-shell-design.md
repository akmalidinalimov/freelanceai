# Telegram Mini App — Phase 1: the shell

**Date:** 2026-08-11 · **Status:** design, awaiting review · **Scope:** Phase 1 of 4

---

## Context

Gigora already runs inside Telegram, but only incidentally. The bot's reply keyboard opens
`/dashboard/seller`, `/messages`, `/search` and `/admin/*` as `web_app` buttons
(`src/lib/telegram-bot.ts:159-196`), `miniAppUrl()` builds those links, and
`TelegramMiniAppBootstrap` signs the user in from Telegram's signed `initData`. So the "Mini App"
today is the website in Telegram's WebView with automatic login.

It reads as a website in a frame, because it is one. Inside Telegram the user sees our header and
logo (Telegram already draws a header), our language switcher (Telegram already knows their
language), a cookie-consent banner (there is no browser to consent about), and our mobile tab bar
sitting directly beneath Telegram's own controls. None of Telegram's native affordances are used:
no BackButton, no MainButton, no haptics, no theme awareness, no keyboard-aware viewport.

For a Telegram-native Uzbek audience this is the difference between an app and a link.

## Decisions taken before this design

| Decision | Choice | Why |
|---|---|---|
| Mini App's role | **Telegram-first** — the primary interface; web keeps SEO, sharing, desktop, admin | Audience lives in Telegram |
| Theme | **Force light, match the frame** | Design system is light-only (`DESIGN.md` parks dark); building dark is its own project |
| Scope | **Phase 1 shell only** | Phases 2-4 depend on it and each deserves its own spec |

## Goals

1. Inside Telegram the app uses Telegram's chrome, not ours.
2. Native affordances work: back, primary action, haptics, frame colours, keyboard-aware viewport.
3. Unsaved work survives a stray swipe-to-close.
4. **The web experience is byte-for-byte unchanged.** Every behaviour here is a no-op outside Telegram.

## Non-goals (deliberately deferred)

- Dark mode / theme following — decided against for now.
- Adapting individual flows (browse, checkout, chat) — Phase 2/3.
- `startapp` deep links and share-to-chat — Phase 2.
- Payments inside the Mini App — Phase 4, and gated on the Stars question in *Risks*.
- Telegram CloudStorage, biometrics, `requestWriteAccess`.

---

## Architecture

### 1. Context detection — server marker plus client fallback

Two independent signals, because each covers the other's blind spot.

**Server (primary).** `miniAppUrl()` is the single place every bot link is built, so it appends
`?tgapp=1`. Middleware sees that param, sets a `gigora_tgapp` session cookie (host-only, `SameSite=Lax`),
and exposes the fact to the server render via a request header, the same mechanism
`src/middleware.ts` already uses for `x-pathname`. The first paint is therefore already correct.

**Client (fallback + capability).** `window.Telegram.WebApp.initData` is non-empty only inside
Telegram. This catches links opened some other way (a forwarded URL, a saved message) and is what
actually drives the native API calls.

*Rejected:* a `(miniapp)` route group. Route groups are static; they cannot switch on runtime
context without duplicating every route, and duplicated routes drift.

*Rejected:* client-only detection. It flashes web chrome on every launch, which is precisely the
cheap-wrapper feel this phase exists to remove.

**Contract:** `isMiniApp` is true if the cookie/header is set **or** `initData` is present.
False on the open web, always.

### 2. Chrome suppression

`src/app/[locale]/layout.tsx` reads the marker server-side and omits, inside Telegram:

| Suppressed | Because |
|---|---|
| `SiteHeader` (logo, nav, language switcher, notification bell) | Telegram draws the header; language comes from Telegram; the bell becomes a bot message |
| Footer | Nothing there applies inside a chat client |
| `MobileBottomNav` | Sits under Telegram's own controls; BackButton replaces it |
| `CookieConsent` | There is no browser-cookie decision to present, and it currently overlays the nav |

The skip-link stays (it costs nothing and helps screen readers). `<main>`'s `pb-16` is dropped
since the bottom nav is gone.

This alone retires four of the five stacked fixed layers flagged in
`docs/audit/2026-08-10/01-findings.md`.

### 3. `useTelegram()` — one guarded surface for the SDK

Every Telegram method is version-gated and **older clients throw on unsupported calls**. This is
the most common way Mini Apps break in the field, so no component touches
`window.Telegram.WebApp` directly. A single hook exposes capability-checked wrappers:

```ts
const tg = useTelegram();
// tg.available            — inside Telegram at all?
// tg.supports("6.1")      — client version gate
// tg.haptic("light")      — no-op if unsupported
// tg.setFrameColors(...)  — no-op if unsupported
// tg.confirmClose(on)     — no-op if unsupported
```

Every wrapper is a no-op when unavailable or unsupported. Nothing throws, on any client, ever.

### 4. BackButton

A client component in the layout: `show()` when there is history to pop, `hide()` at a root
screen (home, search, orders, messages), `onClick` → `router.back()`. Roots come from one
exported list so it cannot drift from the nav.

### 5. MainButton — declared by the page, rendered by Telegram

Telegram's MainButton is native and singular, so pages cannot each render their own. A
`useMainButton({ text, onClick, enabled, loading })` hook claims it for the mounted screen and
releases it on unmount. Last mount wins; unmount restores the previous claim.

Phase 1 wires three call sites as proof, and leaves the rest to Phase 2/3:

| Screen | MainButton |
|---|---|
| Gig detail | `Buyurtma berish` |
| Message thread | `Yuborish` |
| Gig wizard, final step | `Eʼlon qilish` |

The in-page button stays rendered on web and is hidden inside Telegram, so there is exactly one
primary action visible in each environment.

### 6. Frame, viewport, haptics, closing confirmation

- **Frame:** `setHeaderColor` / `setBottomBarColor` to Gigora's sand token so the frame is
  deliberate rather than mismatched for a dark-mode user.
- **Viewport:** `expand()` on launch; bind `viewportStableHeight` to a CSS variable so the message
  composer is not covered by the keyboard.
- **Haptics:** `impactOccurred("light")` on primary actions; `notificationOccurred` on
  success/failure of order and delivery transitions. Nowhere else — haptics stop meaning anything
  if everything buzzes.
- **Closing confirmation:** `enableClosingConfirmation()` while the gig wizard holds unsaved
  input, disabled on submit or clear. The wizard already autosaves to `localStorage`; this stops
  a stray swipe discarding work in the first place.

---

## Files

**New**
- `src/lib/miniapp.ts` — `MINIAPP_PARAM`, `MINIAPP_COOKIE`, `isMiniAppRequest(headers)`, root-screen list
- `src/components/telegram/use-telegram.ts` — the guarded SDK surface
- `src/components/telegram/use-main-button.ts` — MainButton claim/release
- `src/components/telegram/telegram-chrome.tsx` — BackButton + frame + viewport + closing confirmation, mounted once

**Modified**
- `src/middleware.ts` — set the cookie from `?tgapp=1`, forward the marker header
- `src/app/[locale]/layout.tsx` — conditional chrome; mount `TelegramChrome`
- `src/lib/telegram-bot.ts` — `miniAppUrl()` appends the param
- `src/components/telegram-miniapp-bootstrap.tsx` — expose context instead of only signing in
- `src/components/order-panel.tsx`, `message-thread.tsx`, `gig-form.tsx` — three MainButton call sites

---

## Testing

Telegram's WebView cannot be driven by Playwright, so the shell is tested by **simulating the
contract**, which is what our code actually depends on.

1. **Server marker (e2e).** Load `/uz/gigs?tgapp=1`: assert no header, no footer, no bottom nav, no
   cookie banner, and that the cookie is set so the next navigation stays correct without the param.
2. **Web is untouched (e2e).** The same routes without the param: chrome present, exactly as today.
   This is the regression that matters most.
3. **Client detection (e2e).** Inject a stubbed `window.Telegram.WebApp` with `initData` signed by
   the test bot token — reusing `signTelegramInitData()` from `e2e/helpers.ts`, already built for the
   login-pairing work — and assert the chrome disappears without the param.
4. **Version gating (unit).** With a stub reporting version `6.0`, assert every `useTelegram()`
   wrapper no-ops rather than throwing; with `7.0`, assert it calls through.
5. **MainButton claim (unit).** Mount two consumers, assert last-wins and that unmount restores
   the previous claim.

The existing 38 e2e specs act as the safety net for "web unchanged".

## Error handling

- Missing or partial `window.Telegram.WebApp` → `available === false`; the app renders as web.
- An unsupported method → no-op, never a throw.
- Cookie present but `initData` absent (a stale forwarded link) → chrome stays suppressed but no
  auto-login is attempted; the existing login UI handles it, as it does today.

---

## Risks

**Telegram Stars policy (affects Phase 4, decide before then).** Telegram requires Stars for
*digital goods* sold inside Mini Apps. Freelance services are generally treated as real-world
services and exempt, but this must be confirmed against current policy before Payme/Click are
wired into the Mini App path — the answer could force a different payment architecture inside
Telegram than on the web.

**Client version fragmentation.** Mitigated by the capability wrapper; the residual risk is a
method that exists but misbehaves on one client build. Mitigation: keep the in-page buttons
functional and hidden rather than removed, so a broken MainButton degrades to a visible control.

**WebView divergence.** This WebView has already produced two real bugs this month (the
`initData` replay problem, the `telegram.org` preload). Assume it will behave unlike a browser
again; keep every native call optional.

## Out of scope → later phases

- **Phase 2** — buyer journey in Telegram + `startapp` deep links so a shared gig opens in-app.
- **Phase 3** — seller journey: notification → order → deliver → reply.
- **Phase 4** — payments, gated on the Stars question above.
