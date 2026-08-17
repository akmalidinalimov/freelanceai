# Telegram Mini App — Phase 1: the shell

**Date:** 2026-08-11 · **Status:** reviewed (eng), scope reduced · **Scope:** Phase 1 of 4

> **Revised after engineering review.** Scope cut from 10 files to 6: MainButton, haptics and
> closing confirmation move to Phase 2, which rewrites those same screens anyway. Three defects
> found in the first draft are fixed below — see *Detection* and *Review findings*.

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
2. Native navigation works: BackButton, frame colours, keyboard-aware viewport.
3. **No user is ever left without a way to navigate** — see the detection contract.
4. **The web experience is byte-for-byte unchanged.** Every behaviour here is a no-op outside Telegram.

Primary action (MainButton), haptics and closing confirmation are Phase 2 — see §5.

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

**Contract — optimistic server, client corrects.** The naive version ("cookie means no chrome")
has a dead end in it: any context where the cookie is set but Telegram is absent renders a page
with no header, no bottom nav, **and** no Telegram back button. The user cannot navigate at all.
Two routes reach it — a stale cookie, and a `?tgapp=1` URL copied out of the Mini App and shared.

So:

```
        request
           │
   ┌───────┴────────┐
   │ cookie or param │──no──▶ render web chrome (unchanged, always)
   └───────┬────────┘
          yes
           │
   suppress chrome  ◀── correct first paint, no flash
           │
      hydration
           │
   ┌───────┴─────────┐
   │ Telegram SDK?   │
   └───┬─────────┬───┘
     yes         no
      │           │
   stay clean   restore chrome + clear cookie
                (worst case: one frame without a header)
```

Middleware also **strips `?tgapp=1`** after setting the cookie, so the marker never survives into
a URL the user can copy and share.

`isMiniApp` is therefore: server-optimistic from cookie/param, authoritative from `initData`
after hydration. False on the open web, always.

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
// tg.atLeast("6.1")       — wraps Telegram's own isVersionAtLeast()
// tg.haptic("light")      — no-op if unsupported
// tg.setFrameColors(...)  — no-op if unsupported
// tg.confirmClose(on)     — no-op if unsupported
```

Every wrapper is a no-op when unavailable or unsupported. Nothing throws, on any client, ever.
Version checks wrap Telegram's built-in `isVersionAtLeast()` rather than comparing version
strings ourselves, and every accessor guards `typeof window` so the module is import-safe on
the server.

### 4. BackButton

A client component in the layout: `show()` when there is history to pop, `hide()` at a root
screen (home, search, orders, messages), `onClick` → `router.back()`. Roots come from one
exported list so it cannot drift from the nav.

### 5. Deferred to Phase 2 — MainButton, haptics, closing confirmation

Cut in review. MainButton needs a claim protocol, and the naive "last mount wins" is broken: in
App Router the incoming page can mount before the outgoing one unmounts, so release-on-unmount
deletes the *new* claim. It needs a keyed claim stack — and it touches `order-panel`,
`message-thread` and `gig-form`, which Phase 2 rewrites anyway. Building the protocol before
Phase 2 says what those screens need is guessing.

Haptics and closing confirmation ride along with it for the same reason.

### 6. Frame and viewport

- **Frame:** `setHeaderColor` / `setBottomBarColor` to Gigora's sand token so the frame is
  deliberate rather than mismatched for a dark-mode user.
- **Viewport:** `expand()` on launch; bind `viewportStableHeight` to a CSS variable so the message
  composer is not covered by the keyboard. Bind it to Telegram's `viewportChanged` event, **not** a
  window resize listener — resize fires continuously while the keyboard animates and would thrash
  the variable.

---

## Files

Six files, down from ten.

**New**
- `src/lib/miniapp.ts` — `MINIAPP_PARAM`, `MINIAPP_COOKIE`, `isMiniAppRequest(headers)`, root-screen list
- `src/components/telegram/use-telegram.ts` — the guarded SDK surface
- `src/components/telegram/telegram-chrome.tsx` — BackButton, frame colours, viewport, and the
  client-side correction that restores chrome when the SDK is absent

**Modified**
- `src/middleware.ts` — set the cookie from `?tgapp=1`, strip the param, forward the marker header
- `src/app/[locale]/layout.tsx` — conditional chrome; mount `TelegramChrome`
- `src/lib/telegram-bot.ts` — `miniAppUrl()` appends the param

---

## Testing

Telegram's WebView cannot be driven by Playwright, so the shell is tested by **simulating the
contract**, which is what our code actually depends on. `signTelegramInitData()` in
`e2e/helpers.ts` already mints valid signed initData (built for the login-pairing work), so a
stubbed `window.Telegram.WebApp` is cheap to assemble.

```
CODE PATHS                                          USER FLOWS
[+] src/lib/miniapp.ts                              [+] Bot button -> Mini App
  |-- isMiniAppRequest()                              |-- [->E2E] opens with no chrome
  |   |-- cookie present -> true                      \-- [->E2E] BackButton returns
  |   |-- param present  -> true
  |   \-- neither        -> false                    [+] Shared URL in a real browser
[+] middleware.ts                                     \-- [->E2E] chrome RESTORED and
  |-- param   -> set cookie AND strip param                      cookie cleared   * trap
  |-- cookie  -> forward header
  \-- neither -> untouched                           [+] Plain web visitor
[+] layout.tsx                                        \-- [->E2E] header/nav/footer all
  |-- marker    -> chrome suppressed                            present, unchanged
  \-- no marker -> chrome present     * REGRESSION
[+] use-telegram.ts                                 [+] Old Telegram client
  |-- SDK absent      -> no-op, no throw               \-- unsupported call no-ops
  |-- version too low -> no-op
  \-- version ok      -> calls through
[+] telegram-chrome.tsx
  |-- SDK present -> back / frame / expand
  \-- SDK absent  -> restore chrome + clear   * trap fix
[+] miniAppUrl() -> appends param

17 paths, all new code.  * = must-have
```

**The two that are not optional:**

1. **`no marker -> chrome present` (regression).** Every existing web user depends on this. The 38
   existing e2e specs are the broader safety net, but this gets an explicit assertion.
2. **`SDK absent -> chrome restored` (the trap).** Load a route with the cookie set and no stubbed
   SDK; assert the header returns and the cookie is cleared. This is the defect review found, so it
   gets the test that proves it stays fixed.

**The rest:** unit tests around `isMiniAppRequest` (3 branches), the `useTelegram` wrappers against
stubs reporting version `6.0` and `7.0`, and middleware's three branches including that the param
is stripped from the redirect location.

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

---

## Review findings (eng review, 2026-08-11)

The first draft of this spec had three defects. All are fixed above.

| # | Sev | Conf | Finding | Resolution |
|---|---|---|---|---|
| 1 | P0 | 9/10 | Chrome suppression keyed on a persisted cookie can leave a user with no header, no bottom nav **and** no Telegram back button — unable to navigate at all | Detection is now optimistic-server / client-corrects (§1) |
| 2 | P1 | 8/10 | `?tgapp=1` travels when a user copies a URL out of the Mini App, so recipients hit defect 1 in a normal browser | Middleware strips the param after setting the cookie (§1) |
| 3 | P1 | 8/10 | MainButton "last mount wins" is wrong — in App Router the incoming page can mount before the outgoing unmounts, so release-on-unmount deletes the new claim | Deferred to Phase 2 with a keyed claim stack (§5) |

Also corrected: hand-rolled version comparison replaced with Telegram's own `isVersionAtLeast()`
[Layer 1 — don't reinvent a documented built-in]; viewport bound to Telegram's `viewportChanged`
rather than a window resize listener, which fires continuously while the keyboard animates.

**Scope reduced 10 files → 6.** MainButton, haptics and closing confirmation all touch
`order-panel`, `message-thread` and `gig-form`, which Phase 2 rewrites. Committing to a
MainButton protocol before Phase 2 defines those screens is guessing.

### What already exists (reused, not rebuilt)

| Existing | Used for |
|---|---|
| `TelegramMiniAppBootstrap` | Extended to expose context; already does `ready()`/`expand()`/sign-in |
| `miniAppUrl()` | Single chokepoint for the marker — one edit, not twenty |
| `middleware.ts` `x-pathname` | Proven mechanism for passing computed state into the render |
| `signTelegramInitData()` (`e2e/helpers.ts`) | Minting signed initData for the Mini App e2e stubs |
| `seller-visibility.ts`, `EmptyState`, skeletons | Untouched; the shell changes chrome, not content |

### NOT in scope

| Deferred | Why |
|---|---|
| MainButton, haptics, closing confirmation | Phase 2 rewrites those screens; protocol needs their requirements first |
| Dark mode | Own project; `DESIGN.md` parks it deliberately |
| `startapp` deep links, share-to-chat | Phase 2 — growth, not shell |
| Payments in the Mini App | Phase 4, gated on the Stars policy question |
| Admin console adaptation | Desktop-shaped wide tables; a Mini App admin is its own decision |
| Loading boundaries | Blocked upstream: `loading.tsx` swallows 307/404 (see `docs/audit/2026-08-10`) |

### Failure modes

| Failure | Test? | Handled? | User sees |
|---|---|---|---|
| Cookie set, Telegram absent | yes (trap test) | yes — chrome restored | One frame without a header, then normal |
| Telegram SDK partially present | yes (version stubs) | yes — `available: false` | Renders as plain web |
| Unsupported method on an old client | yes | yes — no-op | Nothing; the feature is simply absent |
| Marker missing inside Telegram | yes (client detection) | yes — client suppresses after hydration | A brief flash of web chrome |
| `viewportChanged` never fires | no | partial — CSS var keeps its default | Composer may sit under the keyboard |

The last row is the one real gap: it degrades rather than breaks, and it needs a device to
reproduce, so it is accepted for Phase 1 and revisited in Phase 2 when the chat screen is adapted.

### Implementation tasks

- [ ] **T1 (P1, human: ~2h / CC: ~15min)** — `src/lib/miniapp.ts` — marker constants, `isMiniAppRequest()`, root-screen list
  - Verify: unit tests, 3 branches
- [ ] **T2 (P0, human: ~3h / CC: ~20min)** — `middleware.ts` + `layout.tsx` — set/strip marker, conditional chrome
  - Surfaced by: findings 1 and 2
  - Verify: e2e "no marker → chrome present" (regression) and "marker → chrome suppressed"
- [ ] **T3 (P1, human: ~2h / CC: ~15min)** — `use-telegram.ts` — guarded SDK surface over `isVersionAtLeast()`
  - Verify: unit tests against stubs at version 6.0 and 7.0
- [ ] **T4 (P0, human: ~3h / CC: ~20min)** — `telegram-chrome.tsx` — BackButton, frame colours, viewport, **and the client correction**
  - Surfaced by: finding 1
  - Verify: e2e trap test — cookie set, no SDK, chrome returns and cookie clears
- [ ] **T5 (P2, human: ~30min / CC: ~5min)** — `miniAppUrl()` appends the marker
  - Verify: unit test on the built URL

Sequential: T1 → T2/T3 in parallel → T4 → T5. No parallel worktree lanes worth splitting; six
files with a shared contract.
