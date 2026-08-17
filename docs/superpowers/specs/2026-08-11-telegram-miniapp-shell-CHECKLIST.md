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

**G2 — Native affordances are unverified on a device.** BackButton behaviour, frame colours and
viewport can only be confirmed inside real Telegram. Stubs prove our code calls the right methods
with the right guards; they cannot prove Telegram does what its docs say.

**G3 — No visual review.** `plan-design-review` was offered and not run. What the app *looks* like
with no header — spacing at the top of each page, whether anything depended on the header for
visual anchoring — is unexamined.

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

---

## Verdict

**DONE_WITH_CONCERNS.** Everything specced is implemented, tested and green, and the two defects
review found are closed with tests that prove it. The concerns are G1 (plumbing without a consumer,
by design) and G2/G3 (device and visual verification not yet done — neither is possible from here).

Recommended before Phase 2: the 5-minute device script above, and `plan-design-review` for the
header-less layout.
