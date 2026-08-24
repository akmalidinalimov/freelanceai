# Gigora platform audit — where the code stands

**Date:** 2026-08-10 · **Commit:** `25ac9ff` · **Scope:** code, security, database, login, UI/UX, marketplace readiness

---

## Method, and why it matters for reading this

Nine specialist agents audited the codebase in parallel against its own written standards (`ENGINEERING-STANDARDS.md`, `DATA-PROTECTION.md`, `ACCESSIBILITY.md`). They produced **82 findings, 81 of them marked "confirmed"** with file and line citations.

Every severe finding was then handed to independent verifiers **instructed to refute it**, and each critical got a second lens asking only: *can this actually be triggered in the current production configuration?*

**All five criticals were downgraded. Thirteen of sixteen severe findings had their severity corrected.** Confident, specific, well-cited claims were still wrong about impact most of the time — usually because the original agent missed a compensating control, or described an attack whose preconditions cannot be met while payments are off.

That is the single most important thing to know about this report: **the numbers below are post-refutation, not first-draft.** A list of 82 alarming findings would have been easy to produce and largely useless.

---

## The verdict

This codebase is **better than its problem list suggests**. The money core is genuinely disciplined — the ledger reconciles, payouts are race-safe under a real advisory lock, order transitions use atomic from-state claims, coupon over-redemption is closed, and there is no cross-tenant IDOR anywhere in ~76 API routes. Those are the hard things, and they were done properly.

The weaknesses cluster in three places, and they share a shape: **good primitives with a missing gate around them.**

1. **Moderation and reputation are enforced by convention, not by code.** A seller can approve their own gig, rewrite an approved one, and manufacture 5★ reviews for free. Nothing about the money is at risk; everything about trust is.
2. **The development database has no defence in depth.** RLS is off and the `anon` role holds full write grants on all 44 tables — for an API the app never uses. Production is unaffected (see correction below), but the default will follow you if you ever move production onto Supabase.
3. **Several flows dead-end.** The buyer cannot reach their orders on a phone. The main login flow can be phished. Search ranks fabricated data.

Nothing found is currently losing money, because no money is currently moving.

---

## Fix now — P0

| # | Finding | Status | Where | Effort |
|---|---|---|---|---|
| 1 | **Seller self-approves any gig past moderation** via `action:"resume"` — owner-scoped route with no status precondition, so `PENDING_REVIEW → ACTIVE` needs one request | CONFIRMED, live | `gig.ts:298` | S |
| 2 | **`anon` role has full SELECT/INSERT/UPDATE/DELETE/TRUNCATE on all 44 tables, RLS disabled** — and the app never uses PostgREST, so this is pure exposure with zero benefit. **Scope: the development database only** — see the correction below | CONFIRMED, dev only | Supabase grants | S |
| 3 | **Reviews are gated on a COMPLETED order, not a real one** — with `FREE_ORDERS=1` the whole loop is four free HTTP calls; ratings also feed Google rich results | CONFIRMED, live | `review.ts:83` | S |
| 4 | **Telegram deep-link login is phishable** — the bot confirms on `/start <token>` with no consent step and no pairing code; the browser-nonce binds the *attacker's* browser | HIGH (was CRITICAL), live | `telegram/webhook/route.ts:256` | M |
| 5 | **Two critical CVEs on the auth path** — `next-auth` "auth checks can fail open", `@auth/core` DoS; plus `sharp`/libvips on user-uploaded images | CONFIRMED, live | `npm audit` | S |

**On #4 specifically** — verification corrected three things worth knowing. The 5-minute expiry *is* enforced. The attacker needs no Origin spoofing (they just use their own browser). And only accounts already keyed to a `telegramId` are takeover-able; a Google-only user gets a new row instead. It still needs fixing before launch: the fix is a **pairing code shown on the login page** that the victim must match in the bot, not merely a Yes/No prompt — a socially-engineered victim taps Yes.

---

## Fix before payments go live — P0-latent

Dormant only because `PAYMENT_PROVIDER` is empty and every order is `isTest`. All become live on day one of a real PSP.

| Finding | Where |
|---|---|
| **Both PSP webhooks report success to the provider even when no settlement happened** — money collected, order orphaned, provider told "OK" | `payme.ts:133`, `click.ts:116` |
| **No outbound refund path exists anywhere** — a dispute refund writes a SUCCEEDED refund row and balances the ledger while no money leaves | `dispute.ts:83` |
| **Tips mint withdrawable balance with no funds collected** (found during planning) | `payments.ts:342` |
| Every Payme payment writes two SUCCEEDED `PAYMENT_IN` rows | `payme.ts:134` |
| Click records no provider transaction id and has no reversal path | `click.ts` |
| The delivery clock starts at order creation, not payment — sellers lose up to 48h of every deadline | `order.ts:114` |
| `FREE_ORDERS` fails **open** on a half-configured provider | `payments.ts:283` |

Full ordered checklist in `05-PSP-GO-LIVE.md`. Do not enable a provider until it is worked top to bottom.

---

## Fix for the experience — P1

The platform's near-term job is getting businesses and freelancers to find each other. These are what stand in the way.

**Dead ends**
- There is **no `/orders` route at all**, and the mobile bottom nav has no Orders or Messages. A phone-only buyer cannot reach their purchase after making it.
- After delivering, the seller gets **no next-step panel** — the action rail is suppressed entirely.
- `PENDING_PAYMENT` with no PSP shows "awaiting payment" **with no way to pay**.
- Every zero-result search discards the buyer's brief.

**Discovery**
- Search ranks on order counts, ratings and "featured" flags that `seed-demo-stats.mjs` fabricates — and **production re-runs that seeder on every deploy**. The ranking model underneath is well built and anti-gaming by construction; it is being fed dishonest inputs.
- The home hero search — the shortest path to a shortlist, two taps — has **no URL, no "see all", and loses state on back**.
- The AI search path accepts **no filters**, and the two discovery surfaces don't compose.
- Gig detail, the conversion page, issues **~20 mostly-sequential DB round trips** including a fully duplicated gig fetch, behind no loading UI.

**Feedback**
- 45 of 46 routes have no `loading.tsx`; four skeletons are built and unused.
- 23 async error surfaces have no `role="alert"` — a direct violation of the repo's own accessibility contract.
- A blocked conversation lets you type a full message, then rejects it with an untranslated English string.

**Integrity of what users see**
- Ratings and revenue are computed from different populations, so the same screen contradicts itself under `FREE_ORDERS`.
- Included revisions are advertised on every package and enforced nowhere.
- Seller response time is displayed in three places and written in zero.

---

## What is genuinely strong

A report that only listed faults would misrepresent this codebase. Verified by the audit, not assumed:

- **The ledger reconciles.** All seven write sites post through pure helpers; every posting set sums to zero, proven by unit tests and a property loop.
- **No cross-tenant IDOR exists** on any of the ~76 routes. The `*WhereForUser` builders are applied consistently, and non-participants get 404 rather than 403 so existence is not leaked.
- **Private media cannot be reached by key guessing.** Both file proxies check relationship *and* that the object is attached to that specific resource. `isOwnUpload` pins prefix, 32 hex chars and extension on every write path.
- **Payout races are closed with a real `pg_advisory_xact_lock`**, and it is proven by an integration test against real Postgres, not asserted.
- **ADMIN is unreachable from user input** — `resolveRole` is the only writer, fed by an env allowlist.
- **The impersonation cookie is unforgeable and cannot outlive its TTL** (expiry is inside the HMAC payload).
- **Suspension takes effect on the next request** because `getCurrentUser` re-reads status from the DB rather than trusting the JWT.
- **Telegram HMAC verification is textbook**, including the two distinct key derivations for widget vs Mini App.
- **The seller funnel's draft protection is excellent** — full-form localStorage autosave, and `autoDraftSellerProfile` derives a usable profile so a seller never faces a blank page.
- **Search ranking is anti-gaming by design** — evidence tiered proven > supported > declared, paid placement kept out of the displayed score, per-seller caps.
- i18n key parity is exact across uz/ru/en (1001 keys each).

---

## What was downgraded, and why it matters

| Original | Corrected | Why |
|---|---|---|
| Telegram takeover — CRITICAL | HIGH | Needs a victim tap in a 5-min window; only hits Telegram-keyed accounts |
| PSP webhooks — CRITICAL | HIGH | Both webhooks are hard-inert: PSP keys are empty, so no caller can reach the settle path |
| No refund path — CRITICAL | HIGH/MEDIUM | No buyer money has ever been collected; exposure across all 117 orders is exactly zero |
| Blocked conversation — CRITICAL | MEDIUM | Not "silent" — the error does render in a `role="alert"`. The real complaint is that it's untranslated and after-the-fact |
| Impersonation status gate — HIGH | LOW | The same admin can already one-click "Reactivate" a suspended user. No capability gain, and it's audited with a visible banner |
| `openDispute` race — HIGH | LOW | Requires hitting a few-millisecond window by hand, and every balance filters `isTest` so the payoff is zero today |
| Report-flag poisoning — HIGH | MEDIUM | The queue sorts on flag *rows*, not the counter — 8,421 reports still produce one row |
| Sybil farming — HIGH | MEDIUM | The email sender is in sandbox mode, so the "360 accounts/hour" loop currently delivers nothing |

---

## Where this sits against Fiverr

Gigora has most of the **nouns** — seller levels, disputes, cancellations, saved searches with alerts, two-way reviews, custom offers, trust-and-safety scanning. What's missing is enforcement and the demand side:

- Several features are **advertised and unenforced**: included revisions, response time, order requirements.
- Dispute resolution is **binary, one-shot and un-timed**; cancellation requests never expire.
- **No buyer-requests / reverse marketplace** — the market is one-directional.
- **No support surface** — no way for a user to reach a human.
- No invoices or tax documents; payouts are not KYC-gated despite the Terms saying they are.

Full scoring in `01-findings.md` under workstream I.

---

## Correction issued during the audit

I initially reported the `anon`-grants finding as production exposure. **That was wrong, and the correction matters.**

Production runs **its own Postgres container** (`deploy/docker-compose.prod.yml:9`, `postgresql://freelanceai:…@db:5432`) with **no published ports**, reachable only inside the Docker network on the VPS. **Supabase is the local development database.** Production user data was never reachable through the grants I described.

What remains true, and is still worth fixing: the development database holds real-shaped data, RLS is off, `anon` has full DML, and the app has no use for that API. It is a free revoke. And if production is ever moved onto Supabase, the same default follows.

Corrected severity: **MEDIUM (dev-only)**, not P0. I'm leaving it in the P0 table with the scope noted because the fix costs minutes.

## What this audit did not cover

- **Live UI verification** (390px layout, 44px tap targets, contrast, keyboard walk). Static analysis found the candidates — `save-heart.tsx:55` is 32px, and five fixed layers can stack on one phone screen — but these need a running app to confirm. Third time they've been deferred.
- **Whether the Supabase REST API actually serves rows to an anon key.** The database-side facts are confirmed by direct query; the network here cannot reach `supabase.com` to complete the proof. The fix is free and should be applied regardless.
- **Legal.** `ADR-001` (UZ data residency) is still OPEN and blocks Instagram sync and KYC images at volume. That needs counsel, not code.
- **Production error visibility.** There is none. The audit could only reason about what *can* break, never what *is* breaking. Adding Sentry is the single highest-leverage observability change available.

---

## Files

| File | Contents |
|---|---|
| `01-findings.md` | All 82 findings, full detail, grouped by workstream, with verification notes inline |
| `02-verification.md` | Every refutation verdict with proof |
| `03-WORST-CASE.md` | Worst-case scenarios by actor, split live vs armed |
| `04-SPECS.md` | Implementation specs, P0 first |
| `05-PSP-GO-LIVE.md` | Ordered checklist before enabling a payment provider |
