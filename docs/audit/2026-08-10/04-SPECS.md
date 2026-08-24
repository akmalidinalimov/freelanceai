# Implementation specs — launch-safety first, then parity

Ordered so that everything required to operate safely comes before everything required to compete. Each spec is problem → solution → acceptance criteria → the test that proves it.

Payments work is **not** here; it lives in `05-PSP-GO-LIVE.md` behind its own gate.

---

# P0 — do these first

## S1. Close the moderation bypass

**Problem.** `resumeGig` writes `status:"ACTIVE"` through `updateOwnedGig` (`gig.ts:298`), correctly scoped to the owner but with **no precondition on the current status**. Moving a gig to ACTIVE is otherwise admin-only: `moderateGig` throws FORBIDDEN for non-admins and `publishGig` deliberately routes an owner's draft to `PENDING_REVIEW`. `GigRowActions` renders Resume for every non-active status, so this is one button, not a crafted request.

**Solution.** Constrain `resume` to the state it was designed for — un-pausing a previously approved gig:
- `resumeGig` targets only `status: "PAUSED"` and requires the gig to have been approved before (add `approvedAt` if it does not exist, or gate on a prior moderation record).
- Anything in `PENDING_REVIEW`, `REJECTED` or `DRAFT` goes to `PENDING_REVIEW` via `publishGig`, never straight to `ACTIVE`.
- `GigRowActions` shows Resume only for `PAUSED`.

**Acceptance.** A seller cannot reach `ACTIVE` from any status without an admin transition. `PAUSED → ACTIVE` still works in one tap.

**Test.** Integration: seller creates a gig (`PENDING_REVIEW`), calls `POST /api/gigs/{id} {action:"resume"}`, expects rejection and status unchanged. Then admin approves, seller pauses, seller resumes → `ACTIVE`.

---

## S2. Revoke the unused database grants

**Problem.** RLS is disabled on all 44 tables and `anon` holds full SELECT/INSERT/UPDATE/DELETE/TRUNCATE on every one. Supabase's model expects RLS to be the protection; here there is none. The app uses **no** `supabase-js` and **no** anon key — it talks to Postgres exclusively through Prisma over the pooler.

**Scope.** This is the **development** database. Production runs its own Postgres container with no published ports (`docker-compose.prod.yml:9`), so production data was never exposed this way. Still worth doing: dev databases accumulate real data, and the same Supabase default would follow production if it ever moves there.

**Solution.** Remove the surface entirely, since nothing consumes it:
```sql
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
```
Then disable the Data API for the project in the Supabase dashboard. Belt and braces: enable RLS with no policies on all application tables, so a future accidental grant still denies.

**Acceptance.** The app is fully functional (Prisma bypasses these grants — it connects as the owner role). An anon-key request against any table returns permission denied.

**Test.** Full e2e suite green after the revoke. Manual: one `curl` against the REST endpoint with the anon key, from a network that can reach it.

**Note.** Must be applied as a migration so a project restore does not silently reinstate the defaults.

---

## S3. Make reviews require a real order

**Problem.** `createReview` (`review.ts:83`) requires `order.status === "COMPLETED"` and buyer ownership, but never `isTest`. `getGigReviews` aggregates with no `isTest` filter either — unlike `recomputeSellerStats` and `browse.ts`, which both filter it. Under `FREE_ORDERS=1` the loop create → deliver → accept → review is four free calls, and the output feeds Google rich results.

**Solution.**
- `createReview` rejects when `order.isTest`.
- `getGigReviews` and every rating aggregate filter `order: { isTest: false }`.
- Same treatment for `engagement.ts` (Trending), the weekly leaderboard and badges, which also count test orders today.
- Add a distinct-buyer floor before a gig can display an aggregate rating.

**Acceptance.** A test order cannot produce a visible review or move any public metric. Ratings and revenue are computed from the same population, so the same screen cannot contradict itself.

**Test.** Integration: complete a free (test) order, attempt a review → rejected; assert `getGigReviews` count unchanged and `trendingScore` unmoved.

---

## S4. Make Telegram login un-phishable

**Problem.** The bot flips a login token to `CONFIRMED` the moment it sees `/start <token>` (`telegram/webhook/route.ts:256`) — no consent step, no requester shown, no code to compare. The `browserNonceHash` binds the session to whoever called `/start`, which in an attack is the attacker. Verification confirmed the 5-minute expiry is enforced and that only accounts already holding a `telegramId` are takeover-able — it is still the primary login button for a Telegram-native audience.

**Solution.** A **pairing code**, not merely a confirmation prompt — a socially-engineered victim will tap "Yes".
- `POST /api/auth/telegram/start` generates a short human-readable code (e.g. `AB-42`) stored on `LoginToken`.
- The login page renders the code **before** opening the deep link (`telegram-deeplink-login.tsx` already has the slot in its `phase==="waiting"` block).
- The bot replies with an inline keyboard showing the code and the requesting browser/city, and only confirms on the callback.
- Require the callback's `from.id` to equal the `/start` sender. Reduce the TTL to 2 minutes.
- While here: the deep-link provider (`auth.ts:69`) is the only one that never checks `user.status !== "ACTIVE"` — add it.

**Acceptance.** A user who did not open the login page themselves has no code to match and cannot complete a sign-in.

**Test.** E2E: start a login in context A, attempt to confirm from context B without the code → rejected. Suspended user cannot sign in via deep link.

---

## S5. Patch the dependency CVEs

**Problem.** 2 critical, 5 high. `next-auth` — "configuration errors can cause existence-based auth checks to fail open" — is in the library running all five providers. `sharp`'s libvips CVEs matter because sharp processes user-uploaded images.

**Solution.** `npm audit fix`, then upgrade `next-auth`/`@auth/core`, `next` and `sharp` to patched majors as needed. Treat the auth upgrade as its own change with the full e2e suite as the gate.

**Acceptance.** `npm audit --omit=dev` reports zero critical and zero high.

**Test.** Existing 35 e2e specs, with particular attention to all five sign-in paths.

---

# P1 — the experience

## S6. Give buyers a way back to their orders

**Problem.** There is no `/orders` route. Orders are reachable only from a dashboard widget or a deep link, and the mobile bottom nav has four items — Home, Search, Explore, Creators — with no Orders and no Messages. A phone-only buyer cannot reach a purchase after making it.

**Solution.** Add `/[locale]/orders` (list, filterable by active/completed, paginated), add Orders and Messages to `MobileBottomNav`, and link it from the dashboard widget's "see all".

**Acceptance.** Every primary object — orders, messages, saved, gigs — is reachable in ≤ 2 taps at 390px.

**Test.** E2E at 390px: place an order, navigate away, reach it again using only the bottom nav.

---

## S7. Stop ranking on fabricated data

**Problem.** Search sorts on order counts, ratings and `featured` that `seed-demo-stats.mjs` invents, and `docker-compose.prod.yml:46` re-runs the seeder **on every production deploy**.

**Solution.** Remove the demo seeder from the production compose. Add a one-off migration to zero fabricated stats on real seller rows. Keep the seeder for local development only.

**Acceptance.** Every number displayed on a card or used in ranking traces to a real order.

**Test.** Assert no `isTest` order contributes to `trendingScore`, `ordersCount` or `ratingAvg`.

---

## S8. Make the hero search a real search

**Problem.** The shortest path to a shortlist — two taps on the home hero — produces results with **no URL, no "see all", and state lost on back**. The AI path accepts no filters, and the two discovery surfaces don't compose. Every zero-result path discards the brief.

**Solution.** Push hero results to `/search?q=…` so they are linkable, shareable and survive back. Let the AI path carry the same filter params as `/gigs`. On zero results, keep the brief and offer: broaden, browse the category, or post it as a request (see S13).

**Acceptance.** A business reaches a ranked shortlist in ≤ 3 interactions from a cold landing, and can share that shortlist as a link.

**Test.** E2E: hero search → shortlist → back → results still there; the URL alone reproduces the shortlist.

---

## S9. Never leave a user without feedback

**Problem.** 45 of 46 routes have no `loading.tsx` while four skeletons sit unused; 23 async error surfaces have no `role="alert"`; a blocked conversation lets you type a full message then rejects it with an untranslated English string; after delivering, the seller sees no next-step panel at all.

**Solution.** Add `loading.tsx` using the existing skeletons to the ten heaviest routes first (gig detail, order, messages thread, both dashboards, creator profile, browse, category, search, admin). Add `role="alert"` to every async error paragraph. Disable the composer and show the localized notice when a conversation is blocked, using the bidirectional check. Add a post-delivery panel telling the seller what happens next and when auto-accept fires.

**Acceptance.** Every state has loading, empty, error and a next action.

**Test.** Route-by-route state inventory in the e2e suite; a11y assertion that every error surface is announced.

---

## S10. Make the gig page fast

**Problem.** Gig detail issues ~20 mostly-sequential DB round trips including a fully duplicated gig fetch, behind no loading UI. The order page does 7. `User.username` — the public storefront key — has no index.

**Solution.** Deduplicate the gig fetch, parallelise independent queries with `Promise.all`, add the missing indexes (`User.username`, plus the five unindexed FKs: `Conversation.gigId`, `Order.gigId`, `Review.authorId`, `SavedGig.collectionId`, `SavedGig.gigId`), and add pagination to the discovery lists that currently truncate silently.

**Acceptance.** Gig page and marketplace p95 < 1.5s on a throttled 4G profile; no page issuing more than 15 queries.

**Test.** Playwright timing assertions plus a Prisma query-count harness.

---

## S11. Enforce what the product advertises

**Problem.** Included revisions are shown on every package and enforced nowhere. Response time is displayed in three places and written in zero. Order requirements are collected but never validated against the gig's prompts and never gate the start of work. An order can be placed with **zero** required inputs while the delivery clock starts.

**Solution.** Enforce the revision count on `requestRevision`. Compute response time from first-reply latency or remove the claim. Require answers to the gig's required prompts before an order can be created, and start `dueAt` when work actually starts.

**Acceptance.** Nothing displayed as a promise is unenforced in code.

**Test.** Integration per rule: exceeding revisions is rejected; an order missing a required answer is rejected.

---

## S12. Bound the abuse surface

**Problem.** The order-lifecycle route has no rate limit at all and `reorder` re-enters `createOrder`, bypassing the only order-creation bucket. Message limits are keyed on IP, not sender. `normalizeEmail` doesn't canonicalise Gmail plus-tags or dots. Referral credit is minted during a GET render from a client-writable cookie with no per-referrer cap and no referrer≠seller check. Bulk credit grant multiplies a 10M cap by 200 with no ceiling or second approver.

**Solution.** Rate-limit the order-lifecycle route and key every user-scoped limit on `user.id` with IP as a secondary. Canonicalise emails. Move referral capture to a POST with a per-referrer cap and a referrer≠seller check. Add a daily ceiling and an alert to bulk credit.

**Acceptance.** No money-or-reputation-bearing action is limited only by IP.

**Test.** Integration: `reorder` respects the order bucket; `me+1@` and `me@` resolve to one account.

---

# P2 — parity

| Spec | Problem | Sketch |
|---|---|---|
| **S13. Buyer requests** | No demand-side surface; the market is one-directional | Let a buyer post a brief and budget; sellers respond with custom offers, which already exist |
| **S14. Dispute SLA** | Resolution is binary, one-shot and un-timed; cancellations never expire | Add response deadlines, an evidence round, partial refunds, and auto-expiry |
| **S15. Support surface** | No way for a user to reach a human | A ticket route landing in the admin console, reusing the conversation model |
| **S16. Invoices** | None; payouts aren't KYC-gated despite the Terms | Generate per-order invoices; gate payouts on `kycStatus` |
| **S17. Real filters** | Budget is a raw UZS text box; no delivery time, language, or track-record filter | Add the filters a business actually shops on |
| **S18. Error tracking** | No production error visibility at all | Sentry or equivalent — the highest-leverage observability change available |
| **S19. Admin i18n + mobile** | 8 admin files have zero `t()`; admin is desktop-only wide tables | Localize and add a responsive card fallback |
| **S20. Session revocation** | The 7-day JWT is a sliding window with no revocation | A token version on the user row, bumped on suspend/delete/logout-all |
| **S21. Auth audit events** | The audit log records no authentication events and has no IP column | Add login/logout/impersonation rows with IP so a session-theft incident is reconstructable |
| **S22. Schema drift CI gate** | Two raw-SQL indexes are invisible to `schema.prisma`; the CI gate meant to catch this was never built | Assert after migrate that both indexes exist |

---

# Sequencing

**Week 1** — S1, S2, S3, S5 (all small, all live). S4 next, it is the largest P0.
**Week 2–3** — S6, S7, S9. These are what a new user actually feels.
**Week 4+** — S8, S10, S11, S12, then the P2 list as the market demands it.

`05-PSP-GO-LIVE.md` runs in parallel and gates payments, not the rest of the roadmap.
