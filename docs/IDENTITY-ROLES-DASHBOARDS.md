# FreelanceAI — Identity, Roles, Onboarding & Dashboards (v2, verified)

Focused spec for the identity layer. Conforms to [ENGINEERING-STANDARDS.md](ENGINEERING-STANDARDS.md);
companion to [BUILD-SPEC.md](BUILD-SPEC.md), [DATA-PROTECTION.md](DATA-PROTECTION.md),
[DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).

**v2 status:** hardened after an adversarial + scale review (qa-verifier) that returned **FAIL on
v1**. Every CRITICAL/HIGH finding below is now designed out. Locked decisions: unified account
model · admin via env allowlist · spec-first.

## 0. What changed in v2 (the review paid off)
| # | v1 flaw the skeptic caught | v2 fix |
|---|---|---|
| C1 | Login token not bound to the originating browser → login-CSRF / account-takeover | **Browser-binding nonce**: httpOnly cookie set on `start`, its hash stored on the token, **required to match on `poll`** (§2) |
| C2/C3 | `db push` enum change `{BUYER,SELLER,ADMIN}→{USER,ADMIN}` corrupts data + breaks the TS build | **Ordered SQL migration** (add `USER` → remap rows → drop old) via `prisma migrate deploy`; repo-wide `BUYER/SELLER` removal gated on `tsc`+tests (§1.1) |
| H1 | Allowlist trusts webhook-supplied id; demotion never revokes | Strong webhook secret (min-len, required-in-prod) + `is_bot` check; **demotion revokes all sessions** (§5) |
| H2 | Webhook not idempotent (Telegram retries) | `update_id` dedup + conditional `updateMany(PENDING→CONFIRMED)` + fast 200 + async send (§2) |
| H3 | DB session lookup on every request (header) | Per-request `cache()` dedup now; **Redis session cache** + access/refresh at scale (§4) |
| H4 | 1.5s polling = load/DoS amplifier | SSE (Redis pub/sub) primary + polling fallback w/ backoff + stop-on-blur (§2, §9) |
| H5 | Rate limiting claimed but **not implemented** | `src/lib/rate-limit.ts` built + wired on `start/poll/webhook/logout` (§2) |
| H6 | `LoginToken`/`TelegramAuthNonce`/`Session` grow unbounded | Scheduled **purge jobs** (§9) |
| M1–M5, L1–L5 | onboarding enforcement point, `requireSeller`, session rotation/logout-all, txn poll exchange, dashboard pagination/rollup, suspended-user, observability | all addressed below |

---

## 1. Account & role model (unified)

| Concept | Field | Meaning |
|---|---|---|
| Privilege tier | `User.role ∈ {USER, ADMIN}` | ADMIN = back-office. Everyone else USER. |
| Seller capability | `User.isSeller: boolean` | true after "Become a creator" (+ `SellerProfile`). |
| Onboarding | `User.onboardingCompleted: boolean` | false until intent chosen on first login. |
| Account status | `User.status ∈ {ACTIVE, SUSPENDED}` | suspended users are rejected in `getCurrentUser` (§4). |

Personas: **Guest** (browse only) · **Buyer** (any USER) · **Creator** (USER + isSeller) · **Admin**.
Everyone can buy; selling is opt-in; a person is never "buyer XOR seller."

### 1.1 Migration plan (SAFE — not `db push`)
The enum narrowing is **destructive** and must be an ordered, reviewed migration with a data step,
applied via `prisma migrate deploy` (introduce `prisma/migrations/`; stop using `db push` in prod):
1. Add `USER` to `UserRole` (keep old values temporarily).
2. `UPDATE "User" SET role='USER' WHERE role IN ('BUYER','SELLER');` (admins keep ADMIN).
3. Drop `BUYER`,`SELLER` from the enum; set `@default(USER)`.
4. Repo cutover (same PR, gated on `tsc` + tests): update schema default, rewrite `authz.test.ts`,
   `grep -rE '\b(BUYER|SELLER)\b'` → 0 role-context hits.
5. Rehearse on a restored prod snapshot before applying. (Live DB currently has ~1 row, but the
   procedure is the standard going forward.)

> **Deploy contract change:** switch the VPS deploy from `prisma db push` to **`prisma migrate deploy`**
> with checked-in migrations (reproducible, rollback-able). Update `deploy/docker-compose.prod.yml`.

---

## 2. Login flow (deep-link, HARDENED)

Bot deep-link login (no phone/password). Files: `src/app/api/auth/telegram/{start,poll}/route.ts`,
`src/app/api/telegram/webhook/route.ts`, `src/components/telegram-deeplink-login.tsx`,
`src/lib/{session,telegram-bot}.ts`. All three endpoints **rate-limited** (`src/lib/rate-limit.ts`).

**start** (`POST`, same-origin, rate-limited): create `LoginToken` (PENDING, 5-min TTL); generate a
**browser nonce**, set it as an httpOnly+Secure cookie (`fa_login_nonce`), store **its hash** on the
token; return `t.me/<bot>?start=<token>`.

**webhook** (`POST`, verified by `X-Telegram-Bot-Api-Secret-Token`, **idempotent**):
- Reject if secret mismatch or `from.is_bot`.
- Dedup on Telegram `update_id` (processed-id guard) — Telegram retries/duplicates.
- Confirm via conditional `updateMany({where:{token, status:PENDING, expiresAt>now}, data:{status:CONFIRMED, telegram fields}})`; treat `count===0` as already-handled.
- Return **200 fast**; `sendMessage` fired async (its failure never blocks the 200, else Telegram retries).

**poll** (`POST`, same-origin, rate-limited): require the `fa_login_nonce` cookie to **match the
token's stored nonce hash** (closes login-CSRF/takeover, C1). Then, in one `$transaction`:
conditional `updateMany(CONFIRMED→CONSUMED)` (count 0 ⇒ already consumed) → `upsertTelegramUser`
(profile fields only) → apply admin/role rules (§5) → `createSession` → `audit('auth.login.deeplink')`.
Clear the nonce cookie. Returns `pending | ok | expired`.

**Realtime:** primary = SSE over Redis pub/sub keyed on token (no busy polling); **fallback** =
polling with backoff (1.5s→5s) that **stops on tab blur** and hard-stops at 3 min (§9).

**Retained-but-removed:** the old Login Widget (`verifyLoginWidget`, `GET /api/auth/telegram`) and
`TelegramAuthNonce` are **deleted** (dead auth surface = attack surface, L4).

---

## 3. Onboarding & role selection
First login (`onboardingCompleted=false`) → `/onboarding`: one question — **Hire creators** (buyer) or
**Offer my work** (creator). `Hire` → set completed, route to buyer dashboard. `Offer my work` →
become-creator wizard (Phase 2) → `isSeller=true` + `SellerProfile` + completed. Non-binding (switch later).

**Enforcement (concrete, M1):** middleware is i18n-only and Edge (no DB) — it **cannot** gate this. A
shared **`requireOnboardedUser()`** runs in the authenticated **layout segment** (`/(app)/layout.tsx`):
not-authed → `/login`; authed + `!onboardingCompleted` → `/onboarding`. Redirects built only from the
trusted origin (`appUrl`), never from client input (no `next` param honored) — no open redirect/loops.

---

## 4. Sessions (at scale)
- **Now:** dedupe `getCurrentUser` per request with React `cache()` so header + layout + page share **one**
  lookup (not 3). Add `status=SUSPENDED` check → suspended user gets no session.
- **At scale (H3):** session→user resolved from **Redis** (write-through cache, short TTL) with the
  Postgres `Session` as source of truth; or an opaque access token (Redis) + DB refresh tier. Commit to
  Redis-backed sessions **before** dashboards ship (they fan out more queries).
- **Rotation/revocation (M3):** rotate session on login & on privilege change; **logout-all** endpoint
  (delete all `Session` for user); **demotion/suspension revokes sessions immediately**.
- **Incident-response reconciliation:** these are **opaque DB tokens, not signed with `SESSION_SECRET`**
  → to mass-logout you **truncate `Session`** (and flush Redis), *not* rotate `SESSION_SECRET`. Fix the
  claim in [DATA-PROTECTION §8](DATA-PROTECTION.md).
- Cookie: httpOnly + Secure + SameSite=Lax; 30-day expiry with rotation.

---

## 5. Admin bootstrap (allowlist, HARDENED)
- Env `ADMIN_TELEGRAM_IDS` (comma-separated). On the poll exchange: `telegramId ∈ list` ⇒ `role=ADMIN`
  (+ `onboardingCompleted=true`); **not** in list and currently ADMIN ⇒ **demote to USER + revoke all
  sessions** (so removing an ID actually takes effect).
- Trust hardening: `TELEGRAM_WEBHOOK_SECRET` **required-in-prod + min length** in `env.ts` (was weak
  `.optional()`); reject `from.is_bot`. The webhook is the root of admin trust — treat its secret as
  top-tier, rotate per runbook.
- Admin is **never** client-selectable. Phase 9: admins promote others from the panel (audited); the
  env allowlist remains break-glass.

---

## 6. Permissions matrix
Enforced **server-side** via `requireUser` / `requireRole` / **`requireSeller`** (new, M2) + ownership-
scoped `where` builders + `assertFound`→404. `defineHandler` gains an **`isSeller`** option. Client nav
is cosmetic only.

| Action | Guest | Buyer | Creator | Admin |
|---|:--:|:--:|:--:|:--:|
| Browse gigs/profiles | ✅ | ✅ | ✅ | ✅ |
| Order, pay, message, review own completed order | — | ✅ | ✅ | ✅ |
| Become a creator | — | ✅ | n/a | ✅ |
| CRUD own gigs, deliver, request payout | — | — | ✅ (own) | ✅ |
| Moderate, resolve disputes, approve payouts, KYC | — | — | — | ✅ |
| Read another user's order/messages/payout | — | — | — | ✅ |

Mandatory **cross-tenant negative tests** (buyer→/dashboard/seller, creator→/admin, A reads B's order).

---

## 7. Dashboards (per persona)
Shared shell + (mobile) bottom tabs. `isSeller` users get a **Buyer↔Creator toggle**; admins get **Admin**.
Every list is **cursor-paginated** (offset banned, per standards). Each ships empty/loading/error states.

- **Buyer `/dashboard`** (all): active orders (status timeline), messages+unread, saved/recent gigs,
  order history+spend (paginated), "Become a creator" CTA.
- **Creator `/dashboard/seller`** (requires isSeller): **earnings** — Held(escrow) / Available / Lifetime
  read from a **`SellerBalance` rollup** updated on each ledger posting (M5; never live-`SUM` the ledger
  per page-load); active-orders queue (action-needed first); gigs manager; analytics (views/orders/conv/
  rating); reviews+reply; withdraw (KYC first time). Toggle to buyer view.
- **Admin `/admin`** (role=ADMIN): overview metrics **from a periodic rollup** (not live aggregates);
  users (search/suspend/promote-audited/impersonate-w-audit); gig moderation; disputes; payouts approve+
  execute (v1 manual C2C); KYC review; feature flags. Desktop-first.

Every dashboard route is authz-guarded server-side regardless of nav visibility.

---

## 8. Data model changes
```prisma
enum UserRole { USER ADMIN }
enum UserStatus { ACTIVE SUSPENDED }

model User {
  role                UserRole   @default(USER)
  status              UserStatus @default(ACTIVE)
  isSeller            Boolean    @default(false)
  onboardingCompleted Boolean    @default(false)
  // phone, kycStatus already present
}

model LoginToken {
  // + browserNonceHash String   // binds confirmation to the originating browser (C1)
}

model ProcessedUpdate { updateId BigInt @id; createdAt DateTime @default(now()) } // webhook dedup (H2)

model SellerBalance { userId String @id; heldUzs Int; availableUzs Int; lifetimeUzs Int; updatedAt DateTime } // dashboard rollup (M5)
```
`SellerProfile` already exists. Applied via **`prisma migrate deploy`** (not push) per §1.1.

---

## 9. Scale architecture (identity, 10K–100K)
- **Sessions:** Redis cache + `cache()` dedup (§4) — removes the per-request Postgres hit.
- **Login realtime:** SSE/Redis pub-sub replaces busy polling; backoff + stop-on-blur on the fallback.
- **Rate limiting:** `rate-limit.ts` (Redis token bucket; pg fallback for single-VPS) on `start/poll/
  webhook/logout` + onboarding/become-creator. Per-IP + per-token caps; blocks `/start` spam (DoS).
- **Purge jobs (pg-boss→Redis/BullMQ):** delete expired `LoginToken`, `ProcessedUpdate`, and
  `Session` (expired) on a schedule; document in OPS-RUNBOOK.
- **Observability (L3):** metrics + structured logs for failed confirms, expired tokens, webhook-secret
  rejections, poll volume, login latency — so H1/H4 attacks are detectable. `/api/health` already live.

---

## 10. Security / threat model (summary)
Admin only via allowlist/audited-promote; all checks server-side; "become a creator" sets `isSeller`
server-side only (never from client role input); admin money/PII actions = step-up + audit (Phase 9);
deep-link bound to browser nonce; webhook secret strong+verified; rate-limited; suspended users blocked.
Full STRIDE per [ENGINEERING-STANDARDS](ENGINEERING-STANDARDS.md) template + [DATA-PROTECTION](DATA-PROTECTION.md).

## 11. Verification gates
- New user → `/onboarding`; Hire→buyer dash; Offer→creator wizard→`isSeller`.
- Allowlisted id → ADMIN after one login; **removed id → demoted + sessions revoked**; non-allowlisted can never reach ADMIN.
- **Login-CSRF test:** a token confirmed under browser A cannot be exchanged for a session by browser B (nonce mismatch → reject).
- Webhook replay (same `update_id` twice) → exactly one confirm, one session, one audit.
- Buyer→/dashboard/seller and creator→/admin → 404; A cannot read B's order/payout (cross-tenant).
- Migration rehearsed on a snapshot; `tsc`+tests green; no `BUYER|SELLER` role refs remain.
- Load: `start/poll` under a login-storm stay within rate limits; no unbounded table growth (purge verified).
- Suspended user → no session; logout-all clears every session.

## 12. Implementation plan (after approval)
1. **Migration**: introduce `prisma/migrations/`, switch deploy to `migrate deploy`; ordered enum remap (§1.1) + `User.status/onboardingCompleted`, `LoginToken.browserNonceHash`, `ProcessedUpdate`, `SellerBalance`.
2. **rate-limit.ts** + wire on `start/poll/webhook/logout`.
3. **Login hardening**: browser-nonce cookie (start) + match (poll); webhook idempotency+is_bot+strong secret; transactional poll exchange; remove dead widget/nonce.
4. **Sessions**: `cache()` dedup + suspended check now; Redis-backed + rotation + logout-all + revoke-on-demotion.
5. **Admin allowlist** promote/demote-with-revoke in the poll exchange; `env.ts` webhook-secret + bot-username required-in-prod.
6. **Onboarding**: `(app)` authenticated layout + `requireOnboardedUser`; `/onboarding` page + action; become-creator wizard (basic).
7. **AuthZ**: `requireSeller` + `defineHandler` `isSeller`; the three dashboards (buyer/creator/admin) with cursor pagination + `SellerBalance` rollup; negative authz tests.
8. **Observability/purge** jobs.
9. First step at implementation: founder's **Telegram numeric ID** ([@userinfobot](https://t.me/userinfobot)) for `ADMIN_TELEGRAM_IDS`.

## 13. Deferred (tracked, not in scope now)
Account deletion/erasure wiring (`anonymizeUser` from DATA-PROTECTION); **account recovery if the user
loses Telegram** (Telegram is currently the single auth factor — consider an optional email/phone
recovery before large-scale launch); bot-blocked UX (sendMessage fails silently → surface a hint).
