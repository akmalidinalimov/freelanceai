# FreelanceAI — Master Build Spec

> **Living document.** This is the authoritative, step-by-step plan we build against
> and edit as we learn. It says *what* to build, *when*, and *how we verify* each step
> before moving on. Companion docs: [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) ·
> [DATA-PROTECTION.md](DATA-PROTECTION.md) · [OPS-RUNBOOK.md](OPS-RUNBOOK.md) ·
> [security.md](security.md) · [deploy-hostinger-vps.md](deploy-hostinger-vps.md).

## How to use this doc
- Build **phase by phase, top to bottom**. Do not start a phase until the previous
  phase's **Verification Gate** passes.
- Every phase: follow the **per-feature loop** (below). The phase is "done" only when
  its gate is green and `qa-verifier` (adversarial review) signs off.
- **Foundations** (§4) are cross-cutting and get woven in at the phase noted — they are
  not optional polish; they are the spine of a secure platform.
- When reality differs, **edit this doc** (update the Changelog at the bottom).

## Per-feature build loop (applies to every feature)
1. **Spec** the feature (story, acceptance criteria, edge cases) in the phase section.
2. **Schema** first — Prisma model + migration; review before coding.
3. **Service** layer (business logic, transactions, invariants) in `src/server/services`.
4. **API/Action** — thin handler via the shared wrapper (auth → authz → validate → service → envelope).
5. **UI** — components + i18n strings (uz/ru/en), loading/empty/error states.
6. **Tests** — unit (logic/money), integration (DB), authz negative tests, E2E for critical paths.
7. **Self-review** → **`qa-verifier`** adversarial gate.
8. **Verify live** (run app / Claude Preview) → **commit** on a branch → PR → `code-review`.

---

## 1. Product summary & locked decisions

Fiverr-style marketplace for **AI creative work** (AI video/images), Central Asia /
**Uzbekistan-first**, multilingual (**uz default**, ru, en).

| Decision | Value |
|---|---|
| Stack | Next.js 15 (App Router) + TypeScript, Tailwind v4, next-intl, Prisma + PostgreSQL 16, Vitest |
| Auth | Telegram (Login Widget + Mini App initData), server-side HMAC, DB sessions |
| Payments v1 | Payme + Click to **accept**; **manual/assisted C2C payouts**; double-entry **accounting ledger** (NOT e-money wallet). Stripe unavailable in UZ. |
| Money model | Integer **UZS** everywhere; funds stay on licensed PSP rails (non-bank can't hold e-money) |
| Hosting | **Single Hostinger VPS** (Ubuntu 24.04): Postgres + Next.js (PM2 standalone) + Nginx/TLS |
| Media | S3-compatible (Cloudflare R2); private deliverables via signed URLs |
| Build mode | Full feature set, delivered in verifiable phases; founder + Claude building together |

---

## 2. Architecture overview

```
                    Internet (HTTPS)
                          │
              ┌───────────▼───────────┐
              │  Nginx (TLS, HTTP/2,   │   Let's Encrypt
              │  headers, gzip)        │
              └───────────┬───────────┘
                          │ proxy :3000
              ┌───────────▼───────────┐     ┌──────────────────┐
              │  Next.js (PM2,         │────▶│ PostgreSQL 16     │ localhost only
              │  standalone, cluster)  │     │ (LUKS disk, SCRAM,│
              │  + pg-boss worker proc │     │  least-priv roles)│
              └───────┬───────┬────────┘     └──────────────────┘
                      │       │
        Telegram Bot ◀┘       └▶ Cloudflare R2 (media; presigned)
        (login, push)            Payme / Click (PSP webhooks)
```

- **One codebase**; one VPS at launch. Worker = a separate PM2 process running pg-boss jobs.
- **Scale path** (later): move Postgres to its own box, add Redis for queue/cache/realtime fan-out, run multiple app instances behind Nginx.

---

## 3. Status snapshot

| Phase | State |
|---|---|
| **P0 Foundation** | ✅ done (scaffold, i18n, full Prisma schema, CI, tests) — commit `9a9803d` |
| **P1 Identity** | ✅ code done + security-reviewed (Telegram auth, sessions); **live login pending DB + bot token** — commit `4af9387` |
| P1.5 Foundations hardening | ⬜ next (see §4) |
| P2–P12 | ⬜ planned (see §5) |

---

## 4. Cross-cutting FOUNDATIONS (build early — woven into P1.5/P2)

These were surfaced by the completeness audit as missing and high-leverage. Add them
**before** building feature routes in P2, so every later feature inherits them.

| Foundation | What | File(s) | Phase | Verify |
|---|---|---|---|---|
| **Env validation** | zod-validate env at boot; refuse to start if `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `DATA_ENC_KEY`, PSP keys missing/weak | `src/lib/env.ts` | P1.5 | boot fails fast on missing secret (test) |
| **Shared API wrapper** | `defineHandler({auth, role, schema})`: authn → authz → zod → same-origin → service → error envelope → audit | extend `src/lib/http.ts` | P1.5 | unit test each gate; one envelope shape |
| **AuthZ + IDOR layer** | `requireRole()`, ownership-scoped query helpers (`getOrderForUser` etc.); ban raw `findUnique` on owned resources | `src/lib/authz.ts`, `src/lib/session.ts` | P1.5 | **cross-tenant negative tests** (A can't read B) |
| **Audit writer** | `audit(actor, action, entity, id, meta)`; append-only | `src/lib/audit.ts` | P1.5 | row written on every money/admin action |
| **Rate limiting** | token bucket (in-memory/pg now, Redis later) on auth, search, message, order, payout, webhooks | `src/lib/rate-limit.ts` | P2 | N+1 in window → 429 |
| **Field encryption** | AES-256-GCM for `User.phone`, `cardMasked`, `Transaction.rawPayload`; key-versioned | `src/lib/crypto/field.ts` | P5/P8 (phone at P2) | round-trip test; ciphertext≠plaintext in DB |
| **Structured logging + error tracking** | pino logs; Sentry/GlitchTip (free SaaS to start); `/api/health` | `src/lib/log.ts`, `/api/health` | P5 | synthetic error appears in tracker |
| **Single-use login nonce** | make Telegram payloads one-time (beyond 60s window) | `src/lib/telegram.ts` | P1.5 (before public launch) | replayed payload rejected |

**Money-code discipline (mandatory in all money phases):** integer UZS only; commission =
`Math.round(amount*pct/100)` server-side once; every financial event in one
`prisma.$transaction`; idempotency keys on webhooks; `postLedger()` rejects any batch
whose entries don't sum to 0; reconciliation job asserts per-order zero-sum + PSP balance.

---

## 5. Phased build plan with verification gates

> Each phase: **Build** (key steps) + **Gate** (must be true to proceed). The gate is the
> definition of done; `qa-verifier` must sign off.

### P1.5 — Foundations & auth hardening  ⬜ NEXT
**Build:** env validation; shared API wrapper; authz/IDOR helpers + role guards; audit
writer; single-use login nonce; apply DB migration on VPS; **live Telegram login** once
bot token set. Tighten `next.config.ts` image `remotePatterns` to the real CDN host.
**Gate:** real Telegram login round-trip works on the VPS (user upserted → session →
dashboard shows user → logout); cross-tenant negative test passes; boot fails on missing
secret; security.md backlog items #1 (nonce) closed. `security-review` + `qa-verifier` pass.

### P2 — Profiles & gigs  ⬜
**Build:** seller onboarding wizard (3-step, autosave); gig CRUD + 3 packages; categories;
portfolio; **media upload** (presigned PUT to R2, type/size/magic-byte validation);
gig moderation states; phone field encryption; loading/empty/error states; design-system
token block + Button states (see DESIGN-SYSTEM). DB `CHECK` constraints (rating, amounts).
**Gate:** a seller creates a gig with media; it renders publicly in uz; only the owner can
edit (authz test); uploads reject bad type/size; 0 CLS on gig card at 360px; lint/type/test green.

### P3 — Discovery & search  ⬜
**Build:** gig grid + cards; gig detail; **Postgres FTS** (`tsv_uz/ru/en` + GIN) + `pg_trgm`
fuzzy/transliteration; faceted filters (category/price/delivery/language/rating) in a mobile
bottom sheet; sort; pagination (cursor); SEO (metadata, sitemap, robots, hreflang); caching
(`revalidate` per route).
**Gate:** keyword + typo + Latin↔Cyrillic search returns expected gigs (`EXPLAIN` uses GIN);
filters work on mobile; LCP < 2.5s on throttled Android; sitemap reachable.

### P4 — Ordering lifecycle (no money yet)  ⬜
**Build:** order state machine (explicit allowed-transitions table) — `PENDING_PAYMENT →
PAID → IN_PROGRESS → DELIVERED → REVISION → COMPLETED/CANCELLED/DISPUTED`; requirements form;
delivery upload (private, signed-URL download); revisions; auto-complete timer (pg-boss job);
order tracker UI; ownership authz on every order action.
**Gate:** full order simulated buyer→seller→deliver→complete (payment stubbed); non-participant
gets 404 on order/messages/delivery files; auto-complete job fires; E2E (Playwright) happy path green.

### P5 — Payments (accept) + ledger  ⬜  *(highest-risk; money correctness)*
**Build:** `PaymentProvider` interface; **Payme** Merchant API + **Click** Prepare/Complete
webhook handlers (signature-verified, idempotent); checkout UI (Payme/Click cards + escrow
copy + UZS breakdown); `postLedger()` zero-sum guard; atomic pay→ledger→state transaction;
commission util + property tests; reconciliation job; pino logging + error tracking + `/api/health`;
PSP-data field encryption; connection pooling/timeouts.
**Gate:** sandbox payment → order PAID + balanced ledger entries (sum=0); **webhook replayed N×
→ exactly one posting** (idempotent); property test `commission+net==amount`; reconciliation
asserts zero-sum; bad webhook signature rejected. `security-review` mandatory. `qa-verifier` pass.

### P6 — Messaging & notifications  ⬜
**Build:** order-scoped chat (SSE over `LISTEN/NOTIFY` + poll fallback; Nginx no-buffer on SSE
route); attachments (presigned, scanned); read receipts; optimistic send; **Telegram-bot push**
mirror; in-app `Notification`s; pg-boss worker for dispatch; expired-session purge job.
**Gate:** message delivered to other party in realtime (<X ms); Telegram push fires on order
events; offline-queued send retries; participants-only access (authz test).

### P7 — Reviews & reputation  ⬜
**Build:** post-completion reviews (only buyer of a COMPLETED order, one per order — enforced);
star + sub-criteria; seller reply; rating aggregation → `SellerProfile.ratingAvg/Count`; seller
levels; response-time metric.
**Gate:** completed order → review updates seller rating; non-buyer or incomplete order can't
review (test); distribution renders.

### P8 — Payouts (manual/assisted) + seller wallet  ⬜
**Build:** withdrawable balance from ledger (held vs available); `PayoutMethod` (tokenized card,
masked); payout request flow; **admin payout console** (approve → execute C2C → upload receipt →
mark paid → ledger PAID_OUT); KYC flow (phone + payout method, framed as "get paid"); audit every
step; payout-amount field encryption.
**Gate:** seller requests payout → admin marks paid → **ledger nets to zero** for that flow →
audit log complete; balance "held vs available" correct (3-seller manual check); only admin can
approve/pay (authz test).

### P9 — Disputes, admin & trust-safety  ⬜
**Build:** cancellation/dispute flow + evidence; **admin** dispute console, moderation queue
(gigs/users/reviews), KYC review, feature-flag UI, impersonation-with-audit, admin step-up for
money actions; refund path + reversing ledger postings; off-platform-contact scrubbing in chat;
media AV/NSFW moderation; soft-delete + retention + data export/erasure (DATA-PROTECTION §rights).
**Gate:** dispute → admin resolves (refund or release) → **ledger reversal correct**; refund
re-credits via PSP; moderation removes a gig; data-export returns a user's data; erasure anonymizes
PII while preserving ledger.

### P10 — Multilingual rollout (RU/EN) + polish  ⬜
**Build:** full RU/EN translation of UI + UGC display strategy; uz Latin/Cyrillic script toggle;
per-locale tsvector for search; hreflang; ICU plurals everywhere; longest-locale layout pass.
**Gate:** all flows pass in uz/ru/en (and uz-Cyrillic); no overflow at 360px; plurals/currency correct.

### P11 — Growth features  ⬜
Promoted gigs, coupons, saved gigs/lists, seller analytics, referral, self-hosted analytics
(Plausible/Umami), structured data (schema.org). Each feature verified in isolation.

### P12 — Legal & PSP partnership (parallel, non-code)  ⬜
Engage Uzbek fintech counsel + tax advisor; confirm **post-2026 data-law conditions** & operator
registration; **public offer (oферта)/ToS/Privacy**; sign PSP/bank agent agreement; then upgrade
P8 to **automated escrow + programmatic payouts** (ATMOS hold/capture). **Gate:** counsel sign-off
+ signed PSP agreement **before** any automated money movement goes live.

---

## 6. Completeness factor matrix (condensed)

Full detail & rationale live in the audit; this is the tracking summary. Status: ✅ done ·
🟡 partial/schema-only · ⬜ missing. Phase = where it lands.

| Area | Key factors | Status → Phase |
|---|---|---|
| Frontend | scaffold/i18n ✅; full component lib, loading/empty/error, a11y, mobile/Mini-App, optimistic UI ⬜ → P2/P3/P6 |
| Backend/API | auth routes ✅, `requireUser` ✅; shared wrapper, service layer, idempotency runtime, pagination ⬜ → P1.5/P4/P5 |
| Data model | core entities ✅, ledger schema 🟡; migration applied 🟡, `PayoutMethod`, soft-delete/retention, FTS cols, CHECK constraints ⬜ → P1.5/P2/P3/P8 |
| AuthZ | authn ✅; **role + IDOR enforcement** ⬜ → **P1.5** (top risk) |
| Payments/Ledger | enums+idempotency keys ✅(schema); webhooks, `postLedger` zero-sum, atomic tx, reconciliation, refunds ⬜ → P5 |
| Search | FTS + trigram + multilingual + facets + ranking ⬜ → P3 |
| Realtime/Msg | schema ✅; SSE transport, Telegram mirror, read logic, attachments ⬜ → P6 |
| Media | env scaffolded 🟡; presigned upload, validation, signed deliverable URLs, AV scan, moderation ⬜ → P2/P9 |
| Jobs/queue | pg-boss + worker + scheduled jobs (auto-complete, purge, reconcile) ⬜ → P5/P6 |
| Notifications | in-app model ✅; Telegram push, prefs ⬜ → P6 |
| Observability | none → pino + Sentry/GlitchTip + `/api/health` + uptime + audit-write ⬜ → P5 |
| Testing | unit ✅; integration, authz negative, E2E, ledger property, coverage gate ⬜ → P4/P5 |
| CI/CD | CI ✅; migrate-drift, gitleaks, `npm audit`, CD-to-VPS, rollback ⬜ → P2/P5 |
| Config/secrets | `.env.example` ✅; runtime env zod, locked perms, per-env separation ⬜ → P1.5/P5 |
| Performance | indexes ✅(most); N+1 discipline, pooling, load test ⬜ → P2/P5/P12 |
| i18n | next-intl ✅; currency/date fmt, UGC i18n, uz Cyrillic ⬜ → P2/P10 |
| SEO/Analytics | none → metadata/sitemap/hreflang/canonical (P3), analytics (P11) |
| Admin/back-office | role ✅; panel/moderation/payout console/flags ⬜ → P8/P9 (launch-critical: manual payouts) |
| Trust & safety | dispute schema 🟡; rate-limit, contact-scrub, review-fraud guard, KYC, moderation ⬜ → P4/P7/P9 |
| Compliance | e-money design ✅; **data-localization decision**, offer/ToS/privacy, tax, data rights ⬜ → P1.5 decision / P9 / P12 |
| Docs | README/security/deploy ✅; ADRs, runbook, API docs ⬜ → ongoing |

---

## 7. Open decisions & top risks

1. **VPS region & data law** — Hostinger has **no Central Asia DC**; nearest VPS = India (Mumbai),
   else EU (Lithuania/Germany). Per the **27 Mar 2026** relaxation, ordinary PII may be hosted
   abroad under conditions; **biometric/genetic data must stay in UZ** (so avoid collecting it, or
   segregate to a UZ host). **Action:** confirm conditions + operator registration with Uzbek
   counsel (P12) before real users; pick region now (recommend EU or India) and record an ADR.
2. **Trust is the conversion bottleneck**, not UI polish — validate the escrow comprehension early
   (DESIGN-SYSTEM "riskiest assumption"): users must be able to explain "money is held until delivery."
3. **AuthZ/IDOR layer is absent today** — must land in P1.5 before any multi-user data routes.
4. **Ledger invariants are schema-only** — runtime enforcement (`postLedger` + reconciliation) is the
   crux of money correctness; do not ship P5 without property tests.
5. **PSP marketplace/split mechanics** — confirm Payme "Platforms & Marketplaces" + ATMOS hold limits
   directly with the provider before P5 design freeze.

---

## 8. Changelog
- 2026-06-29 — Spec created from 3 specialist reviews (UX, full-stack+data-protection, Hostinger ops).
  Added Foundations (§4), data-localization update, P1.5 phase. P0/P1 complete.
