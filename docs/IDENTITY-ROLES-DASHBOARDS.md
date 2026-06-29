# FreelanceAI — Identity, Roles, Onboarding & Dashboards

Focused spec for the identity layer. Companion to [BUILD-SPEC.md](BUILD-SPEC.md),
[DATA-PROTECTION.md](DATA-PROTECTION.md), [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).
Status: **proposed** (for review before implementation). Decisions locked with the
founder: unified account model · admin via env allowlist · spec-first.

---

## 1. Account & role model (unified)

One account per person. Everyone can **buy**; selling is an opt-in capability; admin
is a separate privilege tier.

| Concept | Field | Meaning |
|---|---|---|
| Privilege tier | `User.role` ∈ `{ USER, ADMIN }` | ADMIN = staff/back-office. Everyone else = USER. |
| Seller capability | `User.isSeller: boolean` | true once the user completes "Become a creator" (has a `SellerProfile`). |
| Onboarding state | `User.onboardingCompleted: boolean` | false until the user picks an intent on first login. |
| Buyer capability | (implicit) | Every authenticated USER can buy/hire. |

**Personas:**
- **Guest** — unauthenticated visitor; can browse gigs, cannot order/message.
- **Buyer (business/client)** — authenticated USER; hires creators.
- **Creator (freelancer)** — USER with `isSeller=true` + a `SellerProfile`; sells gigs. Still a buyer too.
- **Admin** — `role=ADMIN`; back-office. Granted only via allowlist (§4).

> **Schema change (migration):** simplify `UserRole` from `{BUYER, SELLER, ADMIN}` to
> **`{USER, ADMIN}`**, add `isSeller` (exists) usage + `onboardingCompleted Boolean @default(false)`.
> Rationale: "buyer vs seller" is a *capability*, not a privilege — modeling it as a flag
> avoids the "can't be both" problem. Applied via `prisma db push` on deploy.

---

## 2. Identity & login (as built — document of record)

Login is **Telegram bot deep-link** (no phone, no password). Implemented files:
`src/app/api/auth/telegram/{start,poll}/route.ts`, `src/app/api/telegram/webhook/route.ts`,
`src/components/telegram-deeplink-login.tsx`, `src/lib/{session,telegram-bot}.ts`.

Flow:
1. **start** (`POST /api/auth/telegram/start`, same-origin) → creates a one-time `LoginToken`
   (PENDING, 5-min TTL), returns `t.me/<bot>?start=<token>`.
2. Browser opens the deep link → Telegram → user taps **Start**.
3. **webhook** (`POST /api/telegram/webhook`, verified by `X-Telegram-Bot-Api-Secret-Token`)
   receives `/start <token>`, marks the token CONFIRMED with the sender's Telegram id/name/username.
4. **poll** (`POST /api/auth/telegram/poll`, same-origin) → on CONFIRMED, upserts the `User`,
   creates a session cookie (httpOnly+Secure), marks token CONSUMED, audits `auth.login.deeplink`.

Security: one-time high-entropy token, short TTL, single-use (PENDING→CONFIRMED→CONSUMED),
same-origin on start/poll, webhook secret header. The older Login Widget (`verifyLoginWidget`,
`/api/auth/telegram` GET) is retained but unused.

**Phone/KYC:** still NOT collected at login. Requested later only when a creator requests a
payout (KYC step, Phase 8), framed as "so we can pay you."

---

## 3. Onboarding & role selection

First login (`onboardingCompleted=false`) → **/onboarding**:
- Single question: **"How will you use FreelanceAI?"** → `Hire creators` (buyer) or `Offer my work` (creator).
- `Hire` → set `onboardingCompleted=true`, route to buyer home/dashboard.
- `Offer my work` → start the **Become-a-creator wizard** (Phase 2): display name (prefilled from
  Telegram), short bio, languages, first gig + 1–3 portfolio samples, pricing template → sets
  `isSeller=true`, creates `SellerProfile`, `onboardingCompleted=true`.
- Either choice is non-binding: a buyer can "Become a creator" later; a creator is always also a buyer.

Routing rule (middleware/layout): authenticated + `!onboardingCompleted` → redirect to `/onboarding`
(except the onboarding route itself and logout).

---

## 4. Admin bootstrap (allowlist)

- Env `ADMIN_TELEGRAM_IDS` = comma-separated trusted Telegram numeric IDs.
- In `upsertTelegramUser` (login): if the user's `telegramId ∈ ADMIN_TELEGRAM_IDS` → set `role=ADMIN`
  (and `onboardingCompleted=true`). Idempotent; re-evaluated each login.
- Admin is **never** self-selectable in any UI. No public path sets `role=ADMIN`.
- Phase 9 option: admins promote other admins from the panel (writes `role`, audited). The allowlist
  remains the root of trust / break-glass.

Verification: a non-allowlisted user can never reach `role=ADMIN`; an allowlisted user is ADMIN after
one login; removing an ID and re-login does not silently keep admin (re-evaluated).

---

## 5. Permissions matrix

Enforced server-side (service layer) via `requireUser` / `requireRole` / `requireSeller` /
ownership-scoped queries (`src/lib/authz.ts`, see [DATA-PROTECTION §4](DATA-PROTECTION.md)).

| Action | Guest | Buyer (USER) | Creator (isSeller) | Admin |
|---|:--:|:--:|:--:|:--:|
| Browse gigs / profiles | ✅ | ✅ | ✅ | ✅ |
| Place order, pay, message seller | — | ✅ | ✅ | ✅ |
| Leave review (own completed order) | — | ✅ | ✅ | ✅ |
| Become a creator (set isSeller) | — | ✅ | n/a | ✅ |
| Create/edit own gigs, deliver orders | — | — | ✅ (own) | ✅ |
| Request payout | — | — | ✅ (own balance) | ✅ |
| Moderate gigs/users, resolve disputes, approve payouts, KYC review | — | — | — | ✅ |
| View another user's order/messages/payout | — | — | — | ✅ |

Cross-cutting: all owned-resource reads use scoped `where` (non-owner → 404); admin money/PII actions
require step-up + audit (Phase 9).

---

## 6. Dashboards (per persona)

Shared shell: top nav + (mobile) bottom tabs. Users with `isSeller` get a **Buyer ↔ Creator view
toggle**; admins get an **Admin** entry. Each dashboard ships with empty/loading/error states.

### 6.1 Buyer dashboard — `/dashboard` (every authenticated user)
- **Active orders** — status-timeline cards (paid → in progress → delivered → completed), action-needed first.
- **Messages** — recent conversations + unread badges.
- **Saved gigs / recently viewed.**
- **Order history & total spend.**
- **Become a creator** CTA (if `!isSeller`).
- Empty state → "Browse services".

### 6.2 Creator dashboard — `/dashboard/seller` (requires `isSeller`)
- **Earnings & balance** — clearly split **Held (in escrow)** vs **Available to withdraw** vs **Lifetime** (UZS).
- **Active orders queue** — orders to deliver; due dates; "needs action" first.
- **Gigs manager** — list with status (active/paused/draft/rejected), edit, pause/activate, create new.
- **Analytics** — gig views, orders, conversion, rating, response time.
- **Reviews** — received reviews + reply.
- **Withdraw** — request payout (Phase 8) → KYC if first time.
- Toggle back to **Buyer view**.

### 6.3 Admin dashboard — `/admin` (requires `role=ADMIN`)
- **Overview** — GMV, take-rate, active orders, new users, open disputes.
- **Users** — search, view, suspend, promote/demote admin (audited), impersonate-with-audit.
- **Gig moderation** — approval/reject queue (`GigStatus`).
- **Disputes** — resolution console (refund / release), evidence.
- **Payouts** — approve & execute the manual C2C payouts (v1), upload receipt, mark paid.
- **KYC review** — verify creator identity/payout details.
- **Feature flags** — toggle `FeatureFlag`s.
- Data-dense, desktop-first.

Navigation logic: header shows `Dashboard` for all; `Admin` only for admins; the Buyer/Creator toggle
only when `isSeller`. Deep links are authz-guarded server-side regardless of nav.

---

## 7. Data model changes

```prisma
enum UserRole { USER ADMIN }          // was BUYER/SELLER/ADMIN

model User {
  // ...
  role                UserRole @default(USER)
  isSeller            Boolean  @default(false)   // creator capability
  onboardingCompleted Boolean  @default(false)
  // phone, kycStatus already present
}
```
- `SellerProfile` already exists (created when becoming a creator).
- Migration via `prisma db push` (the deploy's migrate step). Existing users: default `USER`,
  `onboardingCompleted=false` (they'll see onboarding once).

---

## 8. Security notes (this layer)
- Admin grant only via allowlist / admin-promote (audited) — never client-selectable. (§4)
- Every role/capability check is **server-side**; client nav is cosmetic. `requireRole`, a new
  `requireSeller`, and ownership-scoped queries enforce access. (IDOR pattern in DATA-PROTECTION §4.)
- "Become a creator" sets `isSeller` server-side only via the wizard endpoint (validated), never from
  client-supplied role.
- Admin money/PII actions: step-up + audit (Phase 9).
- Onboarding redirect must not create an open redirect; route only to internal paths.

---

## 9. Verification gates
- New user → lands on `/onboarding`; picking "Hire" → buyer dashboard; "Offer my work" → creator wizard → `isSeller=true`.
- Allowlisted Telegram ID → ADMIN after one login; non-allowlisted can never become ADMIN (test).
- Buyer cannot access `/dashboard/seller` (no isSeller) or `/admin` → 404/redirect (authz test).
- Creator cannot access `/admin`; cannot read another user's order/payout (cross-tenant test).
- A user with `isSeller` can toggle buyer/creator views; admin sees Admin entry.
- All three dashboards render in uz/ru/en with empty/loading/error states; 0 CLS on cards.

---

## 10. Implementation plan (after approval)
1. Schema: `UserRole {USER, ADMIN}`, `onboardingCompleted`; `prisma db push` on deploy.
2. `ADMIN_TELEGRAM_IDS` env + promote-on-login in `upsertTelegramUser`; add to env validation + deploy.
3. `requireSeller` + onboarding redirect (layout/middleware).
4. `/onboarding` page (intent selection) + server action to set buyer / launch creator wizard.
5. "Become a creator" wizard (basic) → `isSeller=true` + `SellerProfile`.
6. Dashboards: buyer (`/dashboard`), creator (`/dashboard/seller`), admin (`/admin`) — scaffolds with real authz, filled per phase.
7. Header: Buyer/Creator toggle + Admin link (authz-driven).
8. Tests: role promotion, onboarding routing, cross-persona authz (negative), dashboard rendering.

> First concrete step at implementation time: collect the founder's **Telegram numeric ID** (from
> [@userinfobot](https://t.me/userinfobot)) for `ADMIN_TELEGRAM_IDS`.
