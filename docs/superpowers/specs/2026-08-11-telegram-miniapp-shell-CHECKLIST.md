# Phase 1 acceptance checklist

**Commit:** `9538822` · **Checked:** 2026-08-17 · Verdict at the bottom.

Three questions per the request: **what** it must deliver, **how** it must deliver it, and the
**quality** bar. Each row cites the evidence, or says plainly that it needs a device.

---

## 1. WHAT it must deliver

| # | Requirement | Status | Evidence |
|---|---|---|---|
| W1 | Our chrome is gone inside Telegram (header, footer, bottom nav, cookie banner) | ✅ | e2e `bot link: the marker suppresses our chrome` — `header` and `nav[aria-label=Primary]` both count 0 |
| W2 | Content still renders; only chrome changes | ✅ | Same test asserts the marketplace search input is visible |
| W3 | Telegram's BackButton drives navigation, hidden on root screens | ⚠️ code-verified only | `telegram-chrome.tsx:74-82` + `isRootPath` unit tests (6). The **native button itself needs a device** |
| W4 | Frame colours match Gigora's sand, so a dark-mode user sees no seam | ⚠️ code-verified only | `setFrameColors("#f3f1ec")`, guarded ≥6.1. Visual result needs a device |
| W5 | Keyboard-aware viewport | ⚠️ code-verified only | Bound to Telegram's `viewportChanged`, sets `--tg-viewport`. **No consumer yet** — see Q5 |
| W6 | Every bot entry point carries the marker | ✅ | 8 unit tests across all three URL builders, buyer/seller/admin keyboards |
| W7 | The web experience is unchanged | ✅ | Dedicated regression e2e + all 38 pre-existing e2e still pass (43 total) |

## 2. HOW it must deliver

| # | Constraint | Status | Evidence |
|---|---|---|---|
| H1 | No flash of web chrome on launch | ✅ by construction | Server suppresses on first paint from the cookie; nothing to flash |
| H2 | A wrong marker can never strand a user without navigation | ✅ | e2e `TRAP FIX` — chrome returns and the cookie is cleared |
| H3 | The marker cannot travel in a shared URL | ✅ | Middleware 307s to the clean URL; e2e asserts `/uz/gigs$` |
| H4 | Old Telegram clients must not throw | ✅ | e2e with a pre-6.0 stub asserts **zero** uncaught page errors |
| H5 | Empty `initData` is not Telegram | ✅ | Unit + e2e. `telegram-web-app.js` loads in ordinary browsers and exposes `""` |
| H6 | One guarded surface; no component touches the SDK directly | ⚠️ partly | **Three** files touch `window.Telegram`: `use-telegram.ts` (guarded) plus pre-existing `telegram-miniapp-bootstrap.tsx:48` and `miniapp-signing-in.tsx:22`. Both of those only *read* `initData` — a property read cannot throw on an old client, unlike a versioned method call — so the safety property holds, but "one surface" is not literally true. Consolidating them is a Phase 2 cleanup |
| H7 | Server-safe imports (no `window` at module scope) | ✅ | Build passes; `getWebApp()` guards `typeof window` |
| H8 | The correction cannot loop | ✅ | Module-scoped `correctionAttempted` + middleware strips the param, so nothing re-sets it |

## 3. QUALITY

| Gate | Result |
|---|---|
| Typecheck | clean |
| Lint | 0 errors |
| Build | clean (22.8s) |
| Unit | **195 passed** (+23 new) |
| Integration | **36 passed** |
| E2E | **43 passed** (+5 new) |
| Files touched | 6 as specced (+3 test files) |
| Scope discipline | MainButton/haptics/closing-confirmation deferred as agreed; nothing crept in |

**Coverage of the new code:** 17 of 17 planned paths have a test. The two flagged
must-haves — the web regression guard and the trap fix — each have a dedicated e2e.

---

## Known gaps, stated plainly

**G1 — `--tg-viewport` has no consumer.** The variable is set correctly but nothing reads it, so
the keyboard-overlap problem it exists to solve is not actually fixed yet. The chat composer is the
consumer, and Phase 2 adapts that screen. Shipping the plumbing now is fine; claiming the keyboard
issue is fixed would not be.

**G2 — Native affordances: narrowed, not closed.** The device script was re-run against **live
`gigora.ai`** with a recording Telegram stub (2026-08-17): **13/13 passed**, including BackButton
hidden on `/uz/gigs` and shown on `/uz/gigs/kop-tilli-ai-ovoz-dublyaji`, both frame colours sent as
`#f3f1ec`, marker stripped from the URL, cookie persistence across navigation, the trap fix, empty
`initData`, and a pre-6.0 client with zero uncaught errors. That moves these from "the local build
behaves" to "the deployed build behaves". What is still unproven is only the last hop: whether
Telegram itself honours the calls. That needs a phone.

**G3 — CLOSED. Visual review done** (390px, 2× DPR, against production). The header-less layout
holds up: `#main` starts at y=0 with the H1 at y=40 on both `/` and `/uz/gigs`, and `pb-16` is
correctly dropped so no dead space sits under the last card. Nothing depended on the header for
anchoring.

One defect found, and it is **not ours**: the homepage hero prompt `<textarea>` is 40px tall with
64px of content (`line-height: 24px`), so its placeholder is clipped mid-sentence at 390px.
Identical on plain web and in the Mini App, so it predates Phase 1 — logged here, not fixed here.

**G4 — Marker-less Mini App launch shows a brief flash.** If a Mini App opens without the param
(an old saved link), the server renders chrome and the client suppresses after hydration. Correct,
but visibly a flash. Self-heals on the next navigation once the cookie is set.

---

## Device test script (5 minutes)

1. Open the bot, tap any keyboard button → **no Gigora header, no bottom tab bar, no cookie banner.**
2. Tap into a gig → **Telegram's back arrow appears**; tap it → returns.
3. Return to a root screen (Search/Orders) → **back arrow disappears.**
4. Check the frame around the app is sand, not stark white or black.
5. Open a chat, tap the message box → note whether the keyboard covers the composer (expected: it
   still might — that is G1, Phase 2).
6. In a normal phone browser, open `gigora.ai/uz/gigs` → **full header and tab bar present.**

If 1, 2 and 6 hold, the shell is doing its job.

**Steps 1, 2, 3, 4 and 6 have since been run against production** (see G2) and all passed. Only
**step 5 still needs a phone** — a desktop browser has no soft keyboard, so the viewport behaviour
`--tg-viewport` exists to serve cannot be exercised there at all.

### A gap the browser found that no test covers

`tgSetChatMenuButton` and `tgMainKeyboard` are **per-chat**, and `webhook/route.ts:333` only calls
them when a user messages the bot. Telegram stores them server-side per chat, so **every user
paired before Phase 1 still has the old unmarked URLs.** For them every launch takes the G4 path —
server renders chrome, client suppresses after hydration — so the flash is per-launch, not
one-time. New users are unaffected.

`setChatMenuButton` sends the user nothing, so a one-time silent backfill over paired Telegram IDs
fixes the primary entry point. The reply keyboard cannot be refreshed without sending a message,
but it self-heals: once the menu button sets the cookie, later keyboard launches carry the marker.

**RESOLVED 2026-08-18.** `deploy/menu-button-sync.ps1` run against production: 31 paired users,
**30 ok, 0 failed, 1 blocked** (that user had blocked the bot and is now marked, so every future
fan-out skips them). One round, no cursor resumption needed. Telegram returned `ok:true` for each
call, so the marked button is stored on its side for all 30 reachable users.

Residual, and small: a user who launches via the **reply keyboard** before ever using the menu
button still has no marker on that first launch, so they take the G4 path once. It heals as soon
as any marked launch sets the cookie, and the keyboard itself refreshes on their next `/start`.

---

## Verdict

**DONE_WITH_CONCERNS.** Everything specced is implemented, tested and green, and the two defects
review found are closed with tests that prove it. The concerns are G1 (plumbing without a consumer,
by design) and G2/G3 (device and visual verification not yet done — neither is possible from here).

Recommended before Phase 2: the 5-minute device script above, and `plan-design-review` for the
header-less layout.
