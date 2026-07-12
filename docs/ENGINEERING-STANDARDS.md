# FreelanceAI — Engineering Standards & Shared Contracts

> **Authoritative integration layer.** Every component spec and every line of code MUST conform
> to this document. It is the contract that makes 12+ components compile into one coherent
> platform instead of islands. Where this conflicts with a component spec, **this wins** — and
> the component spec must be corrected.
>
> Companion docs: [BUILD-SPEC.md](BUILD-SPEC.md) (what/when to build) ·
> [DATA-PROTECTION.md](DATA-PROTECTION.md) (security/PII spine) · OPS-RUNBOOK.md ·
> deploy docs. This doc is the **how every layer talks to every other layer**.
>
> Grounded in the real repo: `src/lib/{api,http,handler,authz,env,session,audit,prisma}.ts`,
> `prisma/schema.prisma`, `src/app/api/**`. Code snippets describe the *contract*, not a paste-in.

**Status of contracts below:** ✅ = exists in repo and is the standard · 🔶 = exists but must
change/extend (called out) · ⬜ = to be built; this doc defines the shape it MUST take.

---

## 0. How to read this (for component-spec authors & agents)

When you write a component spec (Profiles, Gigs, Orders, Payments, Messaging, Reviews, Payouts,
Disputes, Admin, Search, Notifications, …), you do **not** redesign any of the contracts here.
You **reference** them and fill in only what is component-specific:

- the **Prisma models/enums** you add (following §5 conventions),
- the **service functions** you add (following §6 pattern),
- the **routes/actions** you add (following §3 + §4 contracts, via `defineHandler`),
- the **i18n keys** you add (§8),
- the **tests** you add (§9),
- the **threat model** (§12 template) and **Definition of Done** (§13 template).

If you find yourself inventing a new error code, a new envelope shape, a new pagination style, a
new auth check, or a new way to do money — **stop**. Either it already exists here, or it belongs
here and you must propose it as an edit to this doc first.

**Companion standards:** UI work must also follow the **WCAG 2.1 AA baseline** in
[`ACCESSIBILITY.md`](./ACCESSIBILITY.md) (label/status/live-region/keyboard/contrast
patterns + the contrast token contract) and the visual system in
[`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md).

---

## 1. Tech stack — pinned majors & runtime assumptions

| Layer | Choice | Pinned major | Notes / assumptions |
|---|---|---|---|
| Runtime | Node.js | **20 LTS** (use 22 LTS only if the VPS image ships it) | Single version across dev/CI/prod. No edge runtime for DB routes. |
| Framework | Next.js (App Router) | **15.x** (`^15.1.3`) | `output: "standalone"`; RSC by default; `"use client"` only where needed. |
| Language | TypeScript | **5.7.x** | `strict: true`. No `any` in committed code (use `unknown` + narrow). |
| UI | React | **19.x** | Server Components first. |
| Styling | Tailwind CSS | **4.x** (`@tailwindcss/postcss`) | Design tokens per DESIGN-SYSTEM.md. `cn()` in `src/lib/utils.ts`. |
| i18n | next-intl | **3.x** (`^3.26.3`) | uz (default) / ru / en. §8. |
| ORM | Prisma | **6.x** (`^6.2.1`) | PostgreSQL provider. `prisma-client-js` generator. |
| DB | PostgreSQL | **16** | Single box at launch, localhost-bound. §5, §10. |
| Validation | zod | **3.x** (`^3.24.1`) | `.strict()` at every boundary. §3. |
| Tests | Vitest | **2.x** (`^2.1.8`) | + Playwright (E2E) ⬜, k6 (load) ⬜. §9. |
| Auth | Telegram (Login Widget + Mini App + bot deep-link) | — | Server-side HMAC, DB sessions, single-use nonce. §4. |
| Icons | lucide-react | `^0.469` | — |
| Lint/format | ESLint 9 (`eslint-config-next`) + Prettier 3 | — | CI-enforced. §10. |
| Background jobs | **pg-boss** (Postgres-backed) ⬜ | — | Redis/BullMQ at scale. §7. |
| Media | Cloudflare R2 (S3-compatible), signed URLs ⬜ | — | Private deliverables never public. §5, §12. |
| Payments | Payme + Click (accept); manual C2C payouts | — | Money never held as e-money; double-entry ledger only. §5. |

**Runtime rules**
- **Version pins are exact majors.** Bumping a *major* of any row above is an ADR + a PR of its
  own, never a drive-by. Minor/patch bumps go through `npm audit` + CI.
- **Module system:** ESM (`"type": "module"`). Path alias `@/*` → `src/*`.
- Every server-only module starts with `import "server-only";` (see `session.ts`, `audit.ts`,
  `handler.ts`, `http.ts`). Pure modules (`api.ts`, `authz.ts`, `env.ts` parse fn) stay import-free
  of `server-only`/DB so they are unit-testable.
- **Deployment note (resolve before P-deploy):** BUILD-SPEC §2 describes **Nginx + PM2**; the
  current ops reality is **Docker + Cloudflare Tunnel** (and a Caddy/TLS variant appears in commit
  history). These must be reconciled in one ADR. Application code MUST NOT depend on which proxy is
  in front — it only assumes (a) it sits behind a trusted reverse proxy that terminates TLS, and
  (b) the real client IP arrives via a trusted forwarded header configured in ops, never read
  naively from the socket.

---

## 2. Repo & module structure — the layering rule

```
src/
  app/
    [locale]/...                 # localized pages (RSC). next-intl segment.
    api/                         # route handlers ONLY. Thin. No business logic.
      <domain>/route.ts          #   e.g. api/orders/route.ts, api/gigs/[id]/route.ts
      health/route.ts            #   liveness/readiness (exists)
  server/
    services/                    # ⬜ DOMAIN SERVICES — all business logic lives here.
      <domain>.ts                #   e.g. orders.ts, payments.ts, ledger.ts, payouts.ts
    jobs/                        # ⬜ pg-boss job handlers (§7)
  lib/                           # shared, cross-cutting primitives (mostly exist)
    api.ts        # ApiResult envelope, ApiError, Errors, parseInput, ok, errorResponse  ✅
    handler.ts    # defineHandler pipeline (CSRF→authn→authz→validate→fn→envelope)        ✅
    http.ts       # getAppOrigin, appUrl, isSameOrigin                                    ✅
    authz.ts      # requireRole, ownership where-builders, assertFound                    ✅
    session.ts    # getCurrentUser, requireUser, createSession, nonce, upsert             ✅
    audit.ts      # audit() append-only writer                                            ✅
    env.ts        # zod env validation (parseEnv pure, serverEnv memoized)                ✅
    prisma.ts     # singleton PrismaClient                                                ✅
    telegram.ts   # HMAC verify of Telegram payloads                                      ✅
    rate-limit.ts # ⬜ token-bucket limiter (§3.6)
    crypto/field.ts # ⬜ AES-256-GCM field encryption (§5, DATA-PROTECTION)
    log.ts        # ⬜ pino structured logger + correlation id (§11)
    money.ts      # ⬜ money helpers (commission split, formatting) (§5)
    pagination.ts # ⬜ cursor encode/decode (§3.4)
    idempotency.ts# ⬜ idempotency-key helpers (§3.5)
  components/                    # presentational + client components (UI only)
  messages/ (repo root)         # uz.json / ru.json / en.json — ALL user-facing strings (§8)
prisma/
  schema.prisma                  # single source of truth for the data model
  migrations/                    # committed; applied with `migrate deploy` in prod (§10)
  seed.ts
```

### The layering rule (non-negotiable)

```
UI (RSC/client)  →  route handler / server action  →  domain service  →  Prisma
   (presentation)        (thin: auth+validate+envelope)   (ALL business logic)   (data)
```

- **No business logic in routes or UI.** A route handler's body is: call a service, return
  `ok(result)`. Errors bubble as `ApiError` and become the envelope automatically. The poll route
  (`src/app/api/auth/telegram/poll/route.ts`) currently inlines logic and hand-rolls its envelope —
  that is the *pre-standard* pattern (🔶). New routes MUST use `defineHandler` + a service.
- **No raw Prisma in routes/UI for owned resources.** All ownership-scoped reads/writes go through
  a service that uses the §4 IDOR-safe pattern.
- **Services are server-only, side-effecting, and the only place that opens `$transaction`,**
  calls `audit()`, and enforces invariants. Services may call other services but must not import
  route/UI code.
- **`lib/` is leaf-level**: primitives with no domain knowledge. `lib/api.ts`, `lib/authz.ts`,
  `lib/env.ts` stay pure (DB-free) so they unit-test without a database.

---

## 3. API contract

### 3.1 The envelope (✅ `src/lib/api.ts` — do not deviate)

Every API response is the discriminated union `ApiResult<T>`:

```ts
type ApiResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: { code: ApiErrorCode; message: string; fields?: Record<string,string> } };
```

- Success: `return ok(data)` → `{ ok: true, data }`.
- Failure: `throw Errors.<code>(...)` (or any `ApiError`) → `errorResponse` produces
  `{ ok: false, error: { code, message, fields? } }` with the right HTTP status.
- **Never** hand-build a response object. **Never** leak internals: non-`ApiError` throwables become
  a flat `500 INTERNAL` with message `"Internal error"` and nothing else.
- Clients branch on `result.ok`. `fields` is the per-field validation map (form binding).

### 3.2 Error-code enum + HTTP mapping (✅ — this is the complete, closed set)

| `ApiErrorCode` | HTTP | When | `Errors.*` factory |
|---|---|---|---|
| `UNAUTHENTICATED` | 401 | No/invalid session | `Errors.unauthenticated()` |
| `FORBIDDEN` | 403 | Authenticated but not allowed; cross-origin reject | `Errors.forbidden()` |
| `NOT_FOUND` | 404 | Resource missing **or** not owned (never reveal existence) | `Errors.notFound()` |
| `VALIDATION` | 422 | zod/input failure; carries `fields` | `Errors.validation(fields)` |
| `CONFLICT` | 409 | State/uniqueness/idempotency/optimistic-lock clash | `Errors.conflict()` |
| `RATE_LIMITED` | 429 | Rate limit exceeded (add `Retry-After`) | `Errors.rateLimited()` |
| `INTERNAL` | 500 | Anything uncaught | `Errors.internal()` (auto) |

**Adding a code is an edit to this doc + `api.ts` + `STATUS` map, in one PR — not a per-component
decision.** If you think you need a new code, you almost certainly mean one of the seven above
(e.g. "payment declined" is a `CONFLICT` or `VALIDATION` with a domain `fields`/`message`, not a new
top-level code). Domain-specific reasons ride in `message` (i18n key) and `fields`, not in new codes.

### 3.3 Validation at every boundary (zod `.strict()`)

- Every route/action/webhook validates input with `parseInput(schema, data)` (`api.ts`) — which
  throws `VALIDATION` with field errors on failure.
- **All object schemas are `.strict()`** (reject unknown keys → mass-assignment defense, DATA-PROTECTION §4).
- **Validate path params too** (cuid shape): `z.string().cuid()`. Never trust `params.id` raw.
- **Server derives trusted values; never accepts them from the client.** `buyerId`, `sellerId`,
  `amountUzs`, `commissionUzs`, `sellerNetUzs`, `status` are computed server-side from the gig/package
  and the session — never read from the request body. The body carries only intent
  (e.g. `gigId`, `packageTier`, `requirements`).
- `defineHandler({ schema })` runs this automatically; the validated, typed `body` is in `ctx.body`.

### 3.4 Cursor pagination (⬜ standard — `src/lib/pagination.ts`)

Offset pagination is **banned** for any list that can grow (gigs, orders, messages, reviews,
notifications, ledger). Standard:

- **Request:** `?limit=<1..50, default 20>&cursor=<opaque>`. `limit` validated by zod.
- **Response `data` shape:**
  ```ts
  { items: T[]; nextCursor: string | null }   // nextCursor null = no more pages
  ```
- **Cursor is opaque** (base64url of the sort key, e.g. `createdAt|id`) — never expose raw offsets
  or row ids as the paging primitive. Decode + validate server-side; an invalid cursor → `VALIDATION`.
- **Query pattern:** keyset, stable secondary sort on `id`:
  ```ts
  prisma.gig.findMany({
    where: scoped, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1, ...(cursor && { cursor: decode(cursor), skip: 1 }),
  });
  ```
  Fetch `limit + 1`, pop the extra to compute `nextCursor`. Every paginated column must be indexed.

### 3.5 Idempotency (⬜ standard — header + table)

Mandatory on **all money mutations and all external webhooks** (order create→pay, refund, payout,
PSP callbacks). Strongly recommended on any non-GET that a client might retry.

- **Client mutations:** caller sends `Idempotency-Key: <uuid>` header. Server stores
  `(key, route, userId) → response snapshot` in an `IdempotencyKey` table (⬜ add to schema:
  `key @id`, `userId`, `route`, `statusCode`, `responseHash`/`response Json`, `createdAt`, `@@index`).
  Same key replayed → return the stored response (don't re-execute). Different body, same key →
  `CONFLICT`.
- **Webhooks:** use `Transaction.idempotencyKey` (`@unique`, already in schema) and the
  `@@unique([provider, providerTxnId])` constraint. Process inside a `$transaction`; a duplicate
  hits the unique constraint → treat as already-processed, return success. **Never trust the amount
  in the webhook** — reconcile against the `Order` (DATA-PROTECTION §5).
- The single-use **login nonce** (`consumeLoginNonce`, `TelegramAuthNonce`) is the same pattern for
  auth replay — follow it.

### 3.6 Rate-limit contract (⬜ `src/lib/rate-limit.ts`)

- Token-bucket, keyed by **userId (if authed) + client IP**. In-memory/Postgres now; Redis at scale
  (§7) — the call site must not change when the backend does.
- Exceed → throw `Errors.rateLimited()` (429) **with a `Retry-After` header**.
- Mandatory on: auth callbacks, message send, order create, payout request, search, webhooks
  (DATA-PROTECTION §5). Default buckets defined centrally in `rate-limit.ts`, referenced by name
  (e.g. `limit("order.create", key)`), never magic numbers in handlers.
- Add to `defineHandler` as an option (`rateLimit: "order.create"`) so it runs as a pipeline gate.

### 3.7 Versioning stance

- **No URL versioning at MVP.** The envelope + closed error enum are the stable contract; we evolve
  additively (new optional fields, new endpoints).
- **Breaking change rule:** removing/renaming a field or changing its type/units is a breaking change
  and requires either (a) an additive migration with a deprecation window, or (b) an ADR introducing
  `/api/v2/*`. Money fields' **units never change** (always integer UZS).

### 3.8 Route conventions

- One resource per folder: `api/<resource>/route.ts`, nested `api/<resource>/[id]/route.ts`.
- HTTP verbs map to intent: `GET` read, `POST` create, `PATCH` partial update, `DELETE`
  soft-delete. State transitions that aren't plain CRUD use an action sub-route
  (`api/orders/[id]/deliver`, `.../accept`, `.../dispute`) — each calls one service function.
- `GET` is side-effect free. All non-GET go through same-origin (§4) + (where money) idempotency.

---

## 4. Auth / session / authz contract

### 4.1 Authentication (✅ `src/lib/session.ts`)

- Identity = **Telegram**, verified server-side by HMAC (`src/lib/telegram.ts`) + 60s freshness +
  single-use nonce (`consumeLoginNonce`).
- Session = opaque 32-byte random token (NOT a cuid) stored in `Session`, set as an **httpOnly,
  `secure` (except dev), `sameSite=lax`, path=/** cookie `fa_session`, 30-day TTL.
- `getCurrentUser()` resolves the user from the cookie (expired → deleted + null).
- **Never** read identity from anything client-controllable except the signed session cookie.

### 4.2 The single enforcement pipeline (✅ `src/lib/handler.ts` — use it everywhere)

Every protected route uses `defineHandler`. Pipeline order is fixed:

```
same-origin (CSRF) → authn (getCurrentUser) → authz (requireRole) → body validation → handler fn → error envelope
```

```ts
export const POST = defineHandler(
  { auth: true, roles: ["SELLER"], schema: CreateGigSchema },   // gates
  async ({ user, body }) => ok(await gigsService.create(user!, body)),
);
```

- `auth: true` → 401 if no session. `roles: [...]` → implies auth + 403 if role mismatch.
- `sameOrigin` defaults to **true for every non-GET** (CSRF defense via `isSameOrigin`, `http.ts`).
  Don't disable it except for verified-signature webhooks (which do their own auth).
- `schema` → validated, typed `ctx.body`. Throwing inside `fn` is fine — it's enveloped.
- **Server actions** that mutate must replicate the same gates by calling `getCurrentUser` +
  `requireRole` + `parseInput` (a `defineAction` wrapper mirroring `defineHandler` is the intended
  shape; until it exists, call the primitives in the same order).

### 4.3 Role & seller model

- Roles: `BUYER | SELLER | ADMIN` (Prisma `UserRole`). `requireRole(user, ...roles)` (`authz.ts`).
- `requireAdmin(user)` for admin-only. There is no `requireSeller` helper yet — use
  `requireRole(user, "SELLER")`. Note `User.isSeller` is a separate flag from `role`; a seller
  acting as a buyer is normal. **Authorize on the relationship, not just the role** (below).

### 4.4 IDOR-safe data access (the hard rule — DATA-PROTECTION §4)

> **NEVER do a bare `findUnique({ where: { id } })` on an owned resource and then check ownership
> in code.** The scoped `where` is the *only* way to fetch it. A non-owned id returns `null` →
> `assertFound` → **404** (we never reveal existence).

Use the ownership `where`-builders in `src/lib/authz.ts` (pure, unit-tested):

| Builder | Resource | Visibility |
|---|---|---|
| `orderWhereForUser(id, user)` | Order | buyer OR seller OR admin |
| `gigEditWhereForUser(id, user)` | Gig (mutate) | owner (seller) OR admin |
| `payoutWhereForUser(id, user)` | PayoutRequest | seller OR admin |
| `conversationWhereForUser(id, user)` | Conversation/Message | order participants OR admin |

```ts
const order = assertFound(
  await prisma.order.findFirst({ where: orderWhereForUser(id, user) })
);
```

- **New owned resource ⇒ add a new `*WhereForUser` builder here** (with a unit test), then use it.
  Do not inline ownership `OR` clauses in services ad hoc.
- Mutating beyond visibility (e.g. only the *seller* may deliver, only *admin* may approve payout)
  is an additional check **inside the service** after the scoped fetch (role-in-relationship gate).
- Mass-assignment guard: zod `.strict()` + never spread the body into Prisma + derive money/owner
  fields server-side (§3.3).

### 4.5 CSRF / same-origin

- All state-changing requests must pass `isSameOrigin` (`http.ts`): `Origin` must equal the trusted
  app origin; fall back to `Referer`; **reject when both absent**. `defineHandler` enforces this for
  non-GET by default.
- Trusted origin comes from `APP_ORIGIN`/`NEXT_PUBLIC_APP_URL` (`getAppOrigin`), **never** from the
  request host. Build redirects with `appUrl(request, path)` only.

---

## 5. Data conventions

### 5.1 Money (the most important rule)

- **All monetary amounts are integer UZS.** Column type `Int`, suffix **`Uzs`** on every money field
  (`amountUzs`, `commissionUzs`, `sellerNetUzs`, `priceUzs`, ...). **No floats, no decimals, ever**
  for money. `Float` appears only for non-money stats (`SellerProfile.ratingAvg`).
- **Rounding rule:** commission is computed **once, server-side**:
  `commissionUzs = Math.round(amountUzs * PLATFORM_COMMISSION_PCT / 100)` (pct from validated env,
  default 20). Then `sellerNetUzs = amountUzs - commissionUzs`. **The two parts always sum to the
  whole** — never round both halves independently. Put this in `lib/money.ts` and test boundaries.
- **Formatting is presentation-only** (§8): integer UZS → localized string at the edge; never store
  formatted money.

### 5.2 Ids, timestamps, enums, naming

- **Ids:** `String @id @default(cuid())` for business entities (opaque, non-sequential). Sessions use
  a high-entropy random token as the id. Cuid shape is *not* a security control — still scope (§4.4).
- **Timestamps:** `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt` on every
  mutable model. Store UTC; localize at the edge. Lifecycle moments get explicit columns
  (`deliveredAt`, `completedAt`, `dueAt`).
- **Enums:** `SCREAMING_SNAKE_CASE` members (`PENDING_PAYMENT`, `RESOLVED_REFUND`). Status fields use
  enums, never free strings — except `Message`/`Notification.type` which are loosely typed today
  (🔶 promote high-traffic ones to enums when stable).
- **Naming:** models `PascalCase` singular; fields `camelCase`; relations named on both sides;
  foreign keys `<rel>Id`. **Index every FK and every column you filter/sort/paginate on**
  (the schema already indexes `sellerId`, `status`, `buyerId`, etc. — keep this up).
- **Locale:** category names are denormalized per-locale (`nameUz/nameRu/nameEn`); user/gig carry a
  `locale` string. New user-facing catalog text follows the per-locale-column pattern.

### 5.3 Snapshots & history

Order rows **snapshot** what was purchased (`packageTier`, `packageTitle`, `amountUzs`) so later gig
edits don't rewrite history. Any purchase/agreement record must snapshot price + terms at creation.

### 5.4 Soft-delete & retention (⬜ — DATA-PROTECTION §6)

- User-erasable / hideable entities get `deletedAt DateTime?` (soft delete) + a default scope that
  excludes deleted rows. **Financial/audit rows are never deleted** (`LedgerEntry`, `Transaction`,
  `AuditLog`) — erasure **anonymizes** PII and keeps the money rows.
- `Transaction.rawPayload` is pruned after reconciliation; sessions are purged by a job.

### 5.5 The double-entry ledger invariant (HARD RULE)

The `LedgerEntry` model is an internal **accounting record, not a regulated e-money wallet**.

- Every financial event posts **balanced** signed entries across `LedgerAccount`
  (`CLIENT_FUNDS`, `PLATFORM_REVENUE`, `SELLER_PAYABLE`, `PAYOUT_CLEARING`).
- **Invariant: the sum of `amountUzs` across the entries of one posting is exactly `0`, and the
  running sum per order nets to `0` after settlement.** A `postLedger(entries)` helper (⬜ in
  `server/services/ledger.ts`) MUST reject any batch that doesn't sum to zero — before any write.
- All ledger writes happen inside the same `$transaction` as the state change that caused them, and
  are followed by an `audit()` call. A reconciliation job (§7) asserts per-order zero-sum **and**
  reconciles against the PSP balance.

---

## 6. Domain service-layer pattern

Every service function follows this shape:

```ts
// src/server/services/orders.ts  (illustrative contract, not paste-in)
export async function createOrder(user: User, input: CreateOrderInput) {
  // 1. authorize on relationship (scoped fetch; never bare findUnique on owned data)
  const gig = assertFound(await prisma.gig.findFirst({ where: { id: input.gigId, status: "ACTIVE" } }));
  const pkg = assertFound(gig.packages.find(p => p.tier === input.packageTier));

  // 2. derive trusted values server-side (never from client)
  const amountUzs = pkg.priceUzs;
  const commissionUzs = Math.round(amountUzs * serverEnv().PLATFORM_COMMISSION_PCT / 100);
  const sellerNetUzs = amountUzs - commissionUzs;

  // 3. enforce invariants + do all writes + ledger in ONE transaction
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({ data: { /* snapshot pkg, derived money, status */ } });
    await postLedger(tx, order.id, [/* balanced entries summing to 0 */]);  // §5.5
    await audit({ actorId: user.id, action: "order.create", entity: "Order", entityId: order.id,
                  metadata: { amountUzs, commissionUzs } });
    return order;
  });
}
```

Rules:

- **Transactions:** any operation touching >1 row that must be consistent (order + ledger, payout +
  ledger, dispute resolution + refund) runs in a single `prisma.$transaction`. Pass `tx` down; don't
  open nested clients. Keep transactions short (no external HTTP inside).
- **Invariants enforced in-service, before commit:** ledger nets to zero (§5.5); state transitions
  are legal (a validated state machine on `OrderStatus` — e.g. only `DELIVERED→COMPLETED` or
  `→REVISION`); one review per completed order; payout amount ≤ withdrawable `SELLER_PAYABLE`.
- **`audit()` is called by services** (not routes) on: login, role change, gig moderation, **every**
  order transition, **every** ledger posting, payout approve/pay, dispute resolution, impersonation,
  data export/erasure (DATA-PROTECTION §6). It never throws into the main flow (failures are
  swallowed + logged) — so call it, don't guard it.
- **Idempotent operations:** money services accept an idempotency key and short-circuit on replay
  (§3.5). PSP webhook handlers are idempotent by construction via the unique constraints.
- Services return domain objects/DTOs; routes wrap with `ok()`. Services throw `ApiError`
  (`Errors.*`) for any failure — never return error sentinels.

---

## 7. Background jobs, caching, realtime

| Concern | MVP (single VPS) | At scale (10K–100K) |
|---|---|---|
| **Jobs/queue** | **pg-boss** on Postgres; one PM2/container worker process. Handlers in `server/jobs/`. | **Redis + BullMQ**; dedicated worker fleet. Call site (`enqueue("payout.process", payload)`) is stable across the swap. |
| **Scheduled** | pg-boss cron: session purge, `rawPayload` prune, **ledger reconciliation**, payout reminders, rating recompute. | Same handlers, Redis-backed scheduler. |
| **Cache** | None / per-request memo + Next.js fetch cache + DB indexes. `serverEnv()` is memoized. | Redis for hot reads (gig listings, seller cards), short TTL, explicit invalidation on write. |
| **Realtime** (chat, notifications, order status) | **SSE** from the single app instance; DB-backed `Notification`/`Message`. | **Redis pub/sub** fan-out across instances behind the proxy; SSE/WebSocket gateway. |

Rules:
- **No business logic in a job that isn't also reachable as a service.** Jobs call services.
- Jobs are **idempotent and retry-safe** (they may run more than once).
- Money-affecting jobs (reconciliation, payout processing) post through the ledger and audit, same
  as request-path services.
- The abstraction boundary (`enqueue`, `publish`, `cache.get/set`) must hide the backend so the
  scale swap is a config change, not a rewrite.

---

## 8. i18n contract (next-intl)

- **Three locales: `uz` (default), `ru`, `en`.** Messages in repo-root `messages/{uz,ru,en}.json`.
- **Every user-facing string is a key** in the message catalogs — no hardcoded UI text, no
  hardcoded strings in `throw`n messages that reach the UI. The three files MUST stay key-synced
  (a CI check asserts identical key sets across locales).
- **Plurals/gender via ICU** (`{count, plural, one {# order} other {# orders}}`); never string-concat
  counts.
- **Money formatting:** integer UZS → `format.number(uzs, { style: "currency", currency: "UZS",
  maximumFractionDigits: 0 })` (or the shared `formatUzs(uzs, locale)` in `lib/money.ts`). Format at
  the edge only; never store formatted money.
- **Dates/times:** store UTC, format with next-intl per the active locale. No locale-baked strings in
  the DB except the intentional per-locale catalog columns (§5.2).
- **API error `message`** should be an i18n key (or a code the client maps), so the same envelope
  renders in the user's locale. `fields` keys are the form field names (stable, not localized).
- Server resolves locale from the `[locale]` route segment (and `User.locale` for notifications/bot
  messages), not from a guess.

---

## 9. Testing strategy & gates

| Level | Tool | Scope | Gate |
|---|---|---|---|
| **Unit** | Vitest | Pure logic: money math, ledger zero-sum, state machines, zod schemas, `authz` builders, `api` envelope, `env` parse. No DB. | Must exist for every service with money or branching logic. |
| **Integration** | Vitest + test Postgres | Service ↔ Prisma: transactions, invariants, idempotency, **IDOR scoped queries**. | Every money/ownership path covered. |
| **Authz negative (cross-tenant)** | Vitest | **A cannot read/mutate B's** order/messages/payout/gig/dispute. | **MANDATORY per component; CI-blocking.** (DATA-PROTECTION §4/§9) |
| **E2E** | Playwright ⬜ | Critical user journeys: login round-trip, buy→pay→deliver→complete→review, payout request→approve→pay, dispute. | Each critical path has one happy + one failure E2E. |
| **Load** | k6 ⬜ | Search, gig listing, order create, webhook ingest at target RPS. | Before scale milestones; p95 latency budget per endpoint. |

**What every component MUST test (Definition-of-Done item):**
1. The **happy path** through the service.
2. **Validation rejection** (bad/unknown fields → 422).
3. **Cross-tenant negative** (other user → 404/403; existence not revealed).
4. **For money:** ledger nets to zero; commission rounding boundary; **idempotent replay** (same key
   → same result, no double-post); illegal state transition rejected.
5. **Loading/empty/error UI states** for any new screen.

**Coverage gate:** lines/branches **≥ 80%** for `src/server/services/**` and `src/lib/**`; money and
authz files target **100% branch**. CI fails below the threshold. (Add `vitest --coverage` to CI.)

---

## 10. CI/CD & migrations contract

**CI gates (all must pass; CI-blocking, on every PR):**
1. `npm run typecheck` (`tsc --noEmit`) — zero errors.
2. `npm run lint` — zero errors.
3. `npm run format:check` — Prettier clean.
4. `npm run test` (Vitest) + coverage gate (§9).
5. `prisma migrate diff` / `prisma validate` — schema and migrations in sync; **no drift**.
6. **Security:** `gitleaks` (secrets) + `npm audit`/`osv-scanner` — block on high/critical
   (DATA-PROTECTION §3).
7. `npm run build` — production build succeeds (standalone output).

**Migrations:**
- **Local/dev:** `prisma migrate dev` (creates + applies migrations). **`db push` is dev-only,
  never against staging/prod**, and never committed as the source of a schema change.
- **Prod/staging:** **`prisma migrate deploy`** (applies committed migrations only), run by the
  dedicated **`freelanceai_migrate`** DB role — **not** the app's runtime role (which has no DDL;
  DATA-PROTECTION §6).
- **Zero-downtime = expand/contract** for anything touching live tables:
  1. *Expand:* add nullable column / new table / backfill (separate, batched) — old + new code both
     work.
  2. Deploy code that writes both / reads new.
  3. *Contract:* drop the old column/constraint in a later migration once no code reads it.
  Never rename-in-place or add a `NOT NULL` without default on a populated table in one step.
- Migrations are **forward-only** in prod (no `migrate reset`). A bad migration is fixed with a new
  migration.

---

## 11. Observability & logging contract

- **Structured logs via pino** (⬜ `src/lib/log.ts`) — JSON, never `console.log` in committed
  server code (`console.error` is acceptable only in the audit fallback). Levels: `error/warn/info/debug`.
- **Correlation id:** generate/propagate a request id per request (header `x-request-id` or
  generated), attach to every log line and to the error tracker. Surface it in `INTERNAL` responses
  for support, but never leak internals.
- **Never log** secrets, full PAN (we store none), `Transaction.rawPayload`, session tokens, or PII
  beyond ids (DATA-PROTECTION §1). Log the **actor id + action**, not the data.
- **Error tracking:** Sentry/GlitchTip (⬜). Unhandled errors and `INTERNAL` envelopes are reported
  with the correlation id; user-facing message stays generic.
- **`/api/health`** (✅): `200 {ok:true,data:{status:"ok",db:"up"}}` when DB reachable, `503`
  degraded otherwise. Used by uptime monitors and the proxy/orchestrator health check. Keep it cheap
  (`SELECT 1`) and `force-dynamic`.
- **Audit log (`audit()`, ✅)** is the security/forensic record (append-only; runtime role lacks
  UPDATE/DELETE) — distinct from operational logs. Use it for *who did what to money/PII*; use pino
  for *what the system did*. Both carry the correlation id where possible.

---

## 12. Security baseline + per-component threat-model template

**Baseline (inherited by every component — DATA-PROTECTION is the full spec):**
- Auth via signed session cookie only; same-origin on all mutations; `defineHandler` gates.
- IDOR-safe scoped queries (§4.4); zod `.strict()` everywhere; server-derived money/owner fields.
- Rate limiting on auth/search/message/order/payout/webhooks; idempotency on money + webhooks.
- Field encryption (AES-256-GCM) for the Sensitive tier; **no full PAN stored**; signed URLs for
  private files; React escaping on output (no `dangerouslySetInnerHTML` on user content).
- Audit every money/PII/admin action; least-privilege DB roles; Postgres localhost-only.
- Secrets server-only + zod-validated at boot (`env.ts`); only the bot *username* is `NEXT_PUBLIC_*`.

**Per-component threat model — fill this in for every component spec:**

```md
### Threat model — <Component>
- Assets: <data/money/PII this component touches; PII tier per DATA-PROTECTION §1>
- Entry points: <routes, actions, webhooks, jobs>
- Actors & roles: <BUYER/SELLER/ADMIN/anon; relationship to the resource>
- Trust boundaries: <client→route, webhook→service, job→service>
- Threats (STRIDE):
  - Spoofing:      <e.g. forged Telegram payload → mitigated by HMAC + nonce>
  - Tampering:     <e.g. client-supplied amount → derived server-side>
  - Repudiation:   <e.g. money action without trace → audit()>
  - Info disclosure: <e.g. read another tenant's order → scoped where + 404>
  - DoS:           <e.g. unbounded list / spam send → rate limit + cursor pagination>
  - Elevation:     <e.g. buyer triggers payout → requireRole + role-in-relationship>
- IDOR check: which *WhereForUser builder gates each owned resource? (add new ones here)
- Idempotency: which mutations need a key? which webhook constraint?
- Negative tests enumerated (cross-tenant, replay, bad-state) → see Tests.
- Residual risk / follow-ups: <...>
```

---

## 13. Per-component DEFINITION OF DONE (template)

Every component spec MUST end with this checklist, and the component is "done" only when every box is
true and `qa-verifier` signs off (mirrors BUILD-SPEC's per-feature loop).

```md
### Definition of Done — <Component>
- [ ] SPEC: user story, acceptance criteria, edge cases, state machine documented.
- [ ] SCHEMA: Prisma models/enums added per §5 (money=Int Uzs, cuid, timestamps, indexes on
      FK/filter/sort cols, snapshots, deletedAt where applicable). Migration created via
      `migrate dev`, reviewed, expand/contract-safe (§10).
- [ ] AUTHZ: new `*WhereForUser` builder(s) added to `src/lib/authz.ts` + unit-tested; ownership
      matrix (DATA-PROTECTION §4) honored; no bare `findUnique` on owned resources.
- [ ] SERVICE: business logic in `src/server/services/<domain>.ts`; `$transaction` for multi-row
      consistency; invariants enforced (ledger nets to 0 if money); `audit()` on every
      money/PII/admin action; idempotency where required (§3.5, §6).
- [ ] API/ACTION: thin handlers via `defineHandler` (auth→role→same-origin→`schema`→service→`ok`);
      zod `.strict()`; cursor pagination for lists (§3.4); rate-limit bucket assigned (§3.6); only
      the seven error codes used (§3.2).
- [ ] UI: components + loading/empty/error states; all strings in `messages/{uz,ru,en}.json`
      (key-synced); UZS + dates formatted at the edge (§8); a11y per DESIGN-SYSTEM.
- [ ] TESTS: unit (logic/money), integration (DB), **cross-tenant negative**, idempotent-replay
      (money), illegal-state-transition; E2E for any critical path; coverage gate met (§9).
- [ ] THREAT MODEL: §12 template completed; residual risks noted.
- [ ] OBSERVABILITY: structured logs with correlation id; no PII/secret logging; audit verified
      in DB; health unaffected.
- [ ] ADVERSARIAL REVIEW: `security-review` + `qa-verifier` pass.
- [ ] VERIFY LIVE: ran the path against a real DB (Claude Preview / local) and observed correct
      behavior + audit rows + ledger zero-sum.
- [ ] SHIP: branch → PR → `code-review`; CI green (typecheck, lint, format, test+coverage,
      migrate-diff, gitleaks/audit, build).
```

---

## Appendix A — canonical handler (copy this shape)

```ts
// src/app/api/gigs/route.ts
import { defineHandler } from "@/lib/handler";
import { ok } from "@/lib/api";
import { z } from "zod";
import * as gigs from "@/server/services/gigs";

const CreateGigSchema = z.object({
  title: z.string().min(3).max(80),
  categoryId: z.string().cuid(),
  // money/owner fields are NEVER in the body — derived server-side
}).strict();

export const POST = defineHandler(
  { roles: ["SELLER"], schema: CreateGigSchema /*, rateLimit: "gig.create" (when added) */ },
  async ({ user, body }) => ok(await gigs.create(user!, body)),
);
```

## Appendix B — known deltas to resolve (don't silently inherit)

These are existing inconsistencies. Each needs an ADR/PR; until resolved, follow the **standard
column** above, not the older artifact.

1. **Proxy/runtime:** BUILD-SPEC says Nginx + PM2; ops reality is Docker + Cloudflare Tunnel (Caddy
   in history). Pick one in an ADR; app code stays proxy-agnostic (§1).
2. **Pre-standard route:** `api/auth/telegram/poll/route.ts` hand-rolls its envelope and inlines
   logic. Migrate to `defineHandler` + an `auth` service when touched (§2, §3.1).
3. **`requireUser()`** in `session.ts` only authenticates (returns `User | null`) — it does **not**
   gate. Gating is `defineHandler`'s job; don't rely on the name implying a guard.
4. **Missing libs this doc mandates:** `rate-limit.ts`, `crypto/field.ts`, `log.ts`, `money.ts`,
   `pagination.ts`, `idempotency.ts`, the `IdempotencyKey` model, and `server/services/*`,
   `server/jobs/*` — build them to the shapes specified here as their phases land.
5. **Loosely-typed `Message.type`/`Notification.type` strings** — promote to enums once stable (§5.2).
```
