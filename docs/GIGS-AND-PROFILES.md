# Profiles & Gigs — Verified Specification (Phase 2)

> **Status:** authoritative build spec for the catalog half of the marketplace.
> **Conforms to** `docs/ENGINEERING-STANDARDS.md` (ApiResult envelope, zod `.strict`, cursor pagination, `*WhereForUser`/IDOR, integer-UZS, layering UI→route/action→service→prisma, test/CI gates), `docs/IDENTITY-ROLES-DASHBOARDS.md` **v2** (`role ∈ {USER, ADMIN}` + `isSeller` capability + `onboardingCompleted`; `requireSeller` gates on `isSeller`), `docs/DESIGN-SYSTEM.md` (mobile-first 360px, multilingual, trust-forward), `docs/DATA-PROTECTION.md` (PII tiers, audit on PII change, erasure, retention).
> **This document is the integration** of the UX draft, the backend draft, the research evidence, and three adversary reports. Every CRITICAL/HIGH finding is resolved inline and tagged `[Cx]`/`[Hx]`/`[Mx]` so it is auditable. Anything not built this phase is in **§14 Deferred**.

---

## 0. Verified repo ground truth (the spec is built on what EXISTS, not what's assumed)

Confirmed by reading the live files (`prisma/schema.prisma`, `src/lib/{authz,handler,env,utils}.ts`):

| Assumed by drafts | Repo reality (verified) | Consequence |
|---|---|---|
| `role ∈ {USER, ADMIN}` + `isSeller` | `enum UserRole { BUYER SELLER ADMIN }`; `User.isSeller Boolean` exists; **no `onboardingCompleted`**, **no `User.status`** | Identity v2 migration is a **hard prerequisite** — §1 PRE |
| `requireSeller` | absent; `authz.ts` has only `requireRole`/`requireAdmin`; `UserLike = Pick<User,"id"\|"role">` | must add + widen `UserLike` |
| `defineHandler({ isSeller, rateLimit })` + `params` | handler passes only `{request,user,body}`; no `isSeller`, no `params`, no `rateLimit` | must extend handler |
| `lib/money.ts` | does **not** exist; `formatUzs` lives in `src/lib/utils.ts`; no commission-split fn | create `lib/money.ts`; fix all refs |
| `GigStatus … PENDING_REVIEW` | `enum GigStatus { DRAFT ACTIVE PAUSED REJECTED }` | add `PENDING_REVIEW` |
| `Gig.slug` per-seller | `slug String @unique` (global) | expand/contract to `@@unique([sellerId,slug])` |
| `PortfolioItem.mediaType` enum | `String @default("image")` | migrate to `MediaType` enum |
| `MediaAsset`, `IdempotencyKey`, `Category` tree | none exist | add models |
| price/media/R2 env | none of `MIN/MAX_GIG_PRICE_UZS`, `MEDIA_*`, `R2_*` | add to `env.ts` |
| `lib/{rate-limit,pagination,idempotency}.ts`, `server/services/`, `server/jobs/` | none exist | build as prerequisites |

**Exit gate for "ground truth is ready":** `grep -rE '\b(BUYER|SELLER)\b'` returns **0** role-context hits (IDENTITY v2 exit criterion) and `pnpm typecheck` is green with the new primitives. **[B1, B2, H1, M4, M5, m3, H4]**

---

## 1. Overview & scope

**Scope (the catalog half):** `SellerProfile`, `PortfolioItem`, `Category`, `Gig`, `GigPackage`, `GigTranslation`, the `MediaAsset` upload pipeline (gig cover/gallery + portfolio), gig lifecycle/moderation, and the public discovery surfaces (creator profile, category browse, gig detail). **Out of scope (referenced only):** orders/payments/escrow (Phase 3 — we honor the price-snapshot rule), reviews (Phase 6 — we read rollups), messaging (`responseMins` source).

**Two prerequisite work-items with their own DoD (must land before any route compiles):**

- **PRE-1 — Identity v2 migration** (`IDENTITY-ROLES §1.1`): `UserRole → {USER, ADMIN}`, add `User.onboardingCompleted Boolean @default(false)` and `User.status` (`ACTIVE | SUSPENDED | DELETED`, default `ACTIVE`). Backfill `role: SELLER→USER` + `isSeller=true`. **Gate:** grep returns 0 `BUYER|SELLER`. **[B1]**
- **PRE-2 — Lib primitives**: `requireSeller`, `defineHandler({isSeller, rateLimit})` + typed `params`, `lib/rate-limit.ts`, `lib/pagination.ts`, `lib/idempotency.ts` + `IdempotencyKey`, `lib/media.ts`, `lib/slug.ts`, `lib/money.ts`. **Gate:** each unit-tested; `defineHandler` no longer needs in-body param parsing. **[H1, H4, M5]**

Do **not** ship the "parse `params.id` in the handler body" workaround as steady state — land typed `params` first. **[H1]**

---

## 2. Data model (Prisma) — refinements, indexes, FTS

🔶 = change/extend, ⬜ = add. Everything else in `schema.prisma` for these models stays.

### 2.1 `User` (PRE-1, listed for completeness)
```prisma
enum UserRole { USER ADMIN }                         // 🔶 was BUYER|SELLER|ADMIN
enum UserStatus { ACTIVE SUSPENDED DELETED }         // ⬜
// User: role UserRole @default(USER); isSeller Boolean @default(false)
//       onboardingCompleted Boolean @default(false) // ⬜
//       status UserStatus @default(ACTIVE)           // ⬜ — gates requireSeller + public scoping [H2]
```

### 2.2 `Category` (🔶 + ⬜) — admin-managed, seeded
```prisma
model Category {
  id        String     @id @default(cuid())
  slug      String     @unique
  nameUz    String
  nameRu    String
  nameEn    String
  parentId  String?
  parent    Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children  Category[] @relation("CategoryTree")
  icon      String?                                  // ⬜ lucide name, not a URL
  position  Int        @default(0)                   // ⬜
  isActive  Boolean    @default(true)                // ⬜ deactivate without delete
  gigCount  Int        @default(0)                   // ⬜ denormalized ACTIVE gigs; incremental +/- in tx, nightly reconcile [m1]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  gigs      Gig[]

  @@index([parentId, position])
  @@index([isActive])
}
```
`gigCount` is maintained by **`±1` delta inside the status-transition transaction** (never `COUNT(*)` on the hot path), reconciled by a nightly job. **[m1]** Deactivate/reparent rules in §6.

### 2.3 `SellerProfile` (🔶) — storefront identity
```prisma
model SellerProfile {
  id              String      @id @default(cuid())
  userId          String      @unique
  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  slug            String      @unique                // ⬜ /creators/<slug>; opaque-ish, see §9 routing [M1]
  headline        String?
  bio             String?                            // zod ≤600; PLAIN TEXT, escaped on render [M3]
  skills          String[]    @default([])           // zod ≤20 × ≤30
  aiTools         String[]    @default([])           // zod ≤20 × ≤30
  languages       String[]    @default([])           // ⬜ allowlist subset; filterable
  level           SellerLevel @default(NEW)          // job-set, never client
  ratingAvg       Float       @default(0)            // stat (Float ok); job-set
  ratingCount     Int         @default(0)
  completedOrders Int         @default(0)            // ⬜ job-set; ranking + badge
  responseMins    Int?                               // ⬜ Messaging phase; null at launch — see §10 empty state [L4]
  isAvailable     Boolean     @default(true)         // ⬜ seller "accepting orders" toggle
  deletedAt       DateTime?                           // ⬜ soft-hide
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  portfolio       PortfolioItem[]

  @@index([level])
  @@index([deletedAt])
}
```

### 2.4 `PortfolioItem` (🔶) — backed by `MediaAsset`
```prisma
model PortfolioItem {
  id        String        @id @default(cuid())
  profileId String
  profile   SellerProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  assetId   String?       @unique                    // ⬜ FK → MediaAsset (source of truth)
  asset     MediaAsset?   @relation(fields: [assetId], references: [id], onDelete: SetNull)
  mediaUrl  String                                    // denormalized public CDN url (join-free reads)
  thumbUrl  String?                                   // ⬜
  mediaType MediaType     @default(IMAGE)            // 🔶 String → enum
  caption   String?                                   // zod ≤200; PLAIN TEXT, escaped [M3]
  position  Int           @default(0)                // server-bounded [H3]
  createdAt DateTime      @default(now())

  @@index([profileId, position])                      // 🔶 compound, ordered reads
}
```

### 2.5 `Gig` (🔶 + ⬜) — central model
```prisma
model Gig {
  id            String    @id @default(cuid())
  sellerId      String
  seller        User      @relation(fields: [sellerId], references: [id], onDelete: Cascade)
  categoryId    String?
  category      Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  // canonical content lives in GigTranslation (§2.7); these are the PRIMARY-locale denorm cache:
  primaryLocale String    @default("uz")             // 🔶 (was `locale`) the seller's authored locale
  title         String                                // primary-locale title denorm (zod 3..80)
  description   String                                // primary-locale desc denorm (zod 50..5000) PLAIN TEXT [M3]
  slug          String                                // 🔶 unique per seller (see @@unique)
  tags          String[]  @default([])                // zod ≤8 × ≤24, lowercased

  // media (denormalized; canonical in MediaAsset)
  coverAssetId  String?                               // ⬜
  coverUrl      String?                               // set ONLY when asset READY [C2]
  coverThumbUrl String?                               // ⬜
  galleryUrls   String[]  @default([])                // ordered, ≤8, READY-only

  // denormalized rollups (job-set, never client)
  ratingAvg     Float     @default(0)                 // ⬜
  ratingCount   Int       @default(0)                 // ⬜
  ordersCount   Int       @default(0)                 // ⬜
  fromPriceUzs  Int       @default(0)                 // ⬜ min(package price); "from" + price-sort

  // moderation lifecycle
  status        GigStatus @default(DRAFT)
  moderatedAt   DateTime?                             // ⬜
  moderatedById String?                               // ⬜ admin id
  rejectionReason String?                             // ⬜ i18n key/note shown to seller
  publishedAt   DateTime?                             // ⬜ FIRST ACTIVE only (stable newest sort)

  searchVector  Unsupported("tsvector")?             // ⬜ single `simple`-config vector (§2.8) [M6]
  deletedAt     DateTime?                             // ⬜
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  packages     GigPackage[]
  translations GigTranslation[]                       // ⬜ [C1]
  orders       Order[]
  reviews      Review[]

  @@unique([sellerId, slug])                          // 🔶 per-seller (expand/contract from global @unique)
  @@index([status, publishedAt(sort: Desc)])          // catalog newest
  @@index([status, ratingAvg(sort: Desc), id])        // 🔶 top-rated, tiebreaker in index [M2]
  @@index([categoryId, status, fromPriceUzs, id])     // 🔶 category+price, tiebreaker in index [M2]
  @@index([sellerId, status, publishedAt(sort: Desc)])// 🔶 hot-seller profile grid, sorted in index [M1]
  @@index([deletedAt])
  // partial-unique on (sellerId, slug) WHERE deletedAt IS NULL via raw SQL — lets a seller reuse a slug after delete [m5]
  // GIN index on searchVector via raw SQL (§2.8)
}
```
**Slug** is **expand/contract** (`STANDARDS §10`): add compound unique → backfill → drop global unique. Public canonical route uses the **opaque id** (`/gig/<id>`), slug cosmetic — kills enumeration/squatting. **[M1, m5]**

### 2.6 `GigPackage` (🔶) — append-only safe for orders
```prisma
model GigPackage {
  id           String      @id @default(cuid())
  gigId        String
  gig          Gig         @relation(fields: [gigId], references: [id], onDelete: Cascade)
  tier         PackageTier
  title        String                                 // zod 3..60
  description  String?                                // zod ≤600
  priceUzs     Int                                    // zod int, MIN..MAX_GIG_PRICE_UZS
  deliveryDays Int                                    // zod 1..90
  revisions    Int         @default(1)                // zod 0..20, -1 = unlimited sentinel
  features     String[]    @default([])               // ⬜ zod ≤10 × ≤60
  position     Int         @default(0)                // ⬜ server-derived from tier order [H3]
  retiredAt    DateTime?                              // ⬜ append-only: edit retires + clones, never destroys a tier referenced by an order [C3]

  @@unique([gigId, tier, retiredAt])                  // 🔶 one LIVE row per tier (retiredAt NULL); retired rows coexist
  @@index([gigId, retiredAt])
}
```
**Edit-after-orders integrity [C3]:** a package row referenced by a **non-terminal order** is **never** mutated or hard-deleted. A material package edit **retires** the current row (`retiredAt=now`) and inserts a new live row; orders still resolve their snapshot via the old row. The `Order` already snapshots `packageTier/packageTitle/amountUzs` — additionally snapshot `deliveryDays`, `revisions`, and `features` onto the order at purchase (Phase 3 contract, flagged here so dispute history is complete). Soft-delete of a gig with non-terminal orders → `CONFLICT`.

### 2.7 `GigTranslation` (⬜ new) — i18n of gig CONTENT **[C1, CRITICAL]**
The product's thesis is uz-default, ru, en. A single scalar `title`/`description` would force a Russian buyer to read Uzbek bodies. Content is multilingual via a translation table; the `Gig` row caches the **primary** locale for join-free list cards.
```prisma
model GigTranslation {
  id          String @id @default(cuid())
  gigId       String
  gig         Gig    @relation(fields: [gigId], references: [id], onDelete: Cascade)
  locale      String                                  // "uz" | "ru" | "en"
  title       String                                  // zod 3..80
  description String                                  // zod 50..5000 PLAIN TEXT
  source      String @default("seller")               // "seller" | "auto" (machine-tr, labelled in UI)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([gigId, locale])
  @@index([gigId])
}
```
**MVP rule (explicit decision):** a gig **must** have a translation for its `primaryLocale`; other locales are optional. Browse/detail resolve `requestedLocale → fallback to primaryLocale` and the UI **labels** the shown language ("Posted in: O‘zbekcha"). Package `title`/`features` stay single-locale at MVP (short, low-risk) — flagged for a later `GigPackageTranslation` if needed. **[C1]**

### 2.8 Full-text search (provisioned now; Search phase consumes) **[M6, L2]**
- **One** `searchVector` column using the **`simple`** config for all locales (no stemmer choice baked in). Postgres has **no Uzbek stemmer** (verified in EVIDENCE) — `simple` is the honest MVP; per-locale stemming/`pg_trgm` autocomplete is a Search-phase spike. Do **not** provision a single column with a contradictory per-locale plan.
- Maintained by a trigger over `title + description + tags` (raw-SQL migration), **GIN-indexed**. Catalog filtering at MVP uses the b-tree indexes above; FTS ranking is deferred. Provisioning the column now avoids a heavy backfill later.

### 2.9 `MediaAsset` (⬜ new) — the only storage-aware model
```prisma
enum MediaType { IMAGE VIDEO }
enum MediaVisibility { PUBLIC PRIVATE }              // PRIVATE = order deliverables (Phase 3); catalog never makes PRIVATE
enum MediaStatus { PENDING UPLOADED SCANNING READY REJECTED DELETED }

model MediaAsset {
  id            String          @id @default(cuid())
  ownerId       String                                // uploader — the authz anchor
  owner         User            @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  visibility    MediaVisibility @default(PUBLIC)
  type          MediaType
  status        MediaStatus     @default(PENDING)
  // storage — TWO buckets: quarantine (private, no public read) + public-served [C2]
  bucket        String                                // logical name (env-mapped)
  quarantineKey String          @unique               // where the client PUTs: q/<ownerId>/<cuid>.<ext>
  storageKey    String?         @unique               // public key, content-hash-named, written ONLY at READY [C2,C3]
  // declared at presign (intent); re-validated post-upload
  mimeType      String                                // allowlist (NO svg) [C3]
  sizeBytes     Int                                   // declared; AUTHORITATIVE check is HEAD post-upload [C1,H5]
  // derived after processing
  width         Int?
  height        Int?
  durationSec   Int?
  checksumSha256 String?
  publicUrl     String?                               // set ONLY when READY + PUBLIC [C2]
  thumbKey      String?
  thumbUrl      String?
  attachedKind  String?                               // "gig.cover"|"gig.gallery"|"portfolio"
  attachedId    String?
  expiresAt     DateTime?                             // PENDING expiry (5 min) [M3-research]
  rejectionReason String?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  portfolioItem PortfolioItem?

  @@index([ownerId, status])
  @@index([status, expiresAt])                        // GC
  @@index([attachedKind, attachedId])                 // orphan detection
}
```

### 2.10 `IdempotencyKey` (⬜) — `STANDARDS §3.5`, body-hash bound **[M5]**
```prisma
model IdempotencyKey {
  key         String   @id                            // client-supplied
  userId      String
  route       String
  requestHash String                                   // ⬜ sha256 of canonical body — mismatch+same key → CONFLICT [M5]
  statusCode  Int
  response    Json
  createdAt   DateTime @default(now())
  @@index([userId, route])
  @@index([createdAt])                                 // TTL GC
}
```
Applied to **`media.presign`**, **`gig.create`** (onboarding double-submit → dup gig/profile [L3]), and **`gig.submit`**. On presign replay, re-check `expiresAt` and **re-sign if stale** (URL TTL < idempotency window). **[M5, m2, L3]**

### 2.11 Money & env (`env.ts` additions)
```
MIN_GIG_PRICE_UZS    z.coerce.number().int().default(50_000)
MAX_GIG_PRICE_UZS    z.coerce.number().int().default(100_000_000)
MEDIA_MAX_IMAGE_MB   z.coerce.number().int().default(10)
MEDIA_MAX_VIDEO_MB   z.coerce.number().int().default(200)
MAX_GIGS_NEW / _LEVEL1 / _LEVEL2 / _TOP_RATED   defaults 5 / 10 / 20 / 50   // per-seller gig cap by level [H2]
MAX_PORTFOLIO_ITEMS  default 30                                              // [H3]
MAX_PENDING_ASSETS   default 20                                              // [H3,H5]
PRESIGN_DAILY_CAP    default 200                                             // [H5]
R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
R2_BUCKET_QUARANTINE / R2_BUCKET_PUBLIC / R2_PUBLIC_CDN_BASE                 // [C2]
```
`R2_*` required only when `NODE_ENV==="production"` (same pattern as `TELEGRAM_BOT_TOKEN`). Only money fields here are `GigPackage.priceUzs` and `Gig.fromPriceUzs` (both `Int`, suffix `Uzs`). `lib/money.ts` provides `formatUzs` (re-exported from current `utils.ts` to avoid churn) **and** the authoritative `commissionSplit(amountUzs)` using `PLATFORM_COMMISSION_PCT`. **[M4, M5]**

---

## 3. API & service contracts

All routes via `defineHandler` (and the form `defineAction` mirror once built — currently absent, tracked in PRE-2 [m3]). Gate uses the **`isSeller` capability** plus `status==='ACTIVE'`, not bare role. Every list is cursor-paginated (`{items, nextCursor}`); offset banned. Every mutation derives owner/server fields server-side and **never spreads the body** into Prisma. All bodies `.strict()` (incl. nested objects).

### 3.1 `requireSeller` (authz.ts) — suspension-aware **[H2]**
```ts
type UserLike = Pick<User, "id" | "role" | "isSeller" | "status">;   // 🔶 widened [M5]
export function requireSeller(user: UserLike): void {
  if (user.status !== "ACTIVE") throw Errors.forbidden("Account not active");   // suspended seller blocked [H2]
  if (!user.isSeller) throw Errors.forbidden("Requires seller capability");
}
```

### 3.2 New IDOR `*WhereForUser` builders (authz.ts; pure, 100% branch-tested)
```ts
export function gigOwnWhereForUser(gigId: string, user: UserLike) {        // owner preview, any status
  return isAdmin(user) ? { id: gigId } : { id: gigId, sellerId: user.id, deletedAt: null };
}
// gigEditWhereForUser: extend existing with `deletedAt: null`
export function mediaWhereForUser(assetId: string, user: UserLike) {
  return isAdmin(user) ? { id: assetId } : { id: assetId, ownerId: user.id };
}
export function portfolioItemWhereForUser(itemId: string, user: UserLike) {
  return isAdmin(user) ? { id: itemId } : { id: itemId, profile: { userId: user.id } };
}
```
**Public reads** (`gigs.getPublic`, `gigs.listPublic`, `profiles.getPublic`) filter `status:"ACTIVE", deletedAt:null` **and** `seller.status:"ACTIVE"` and `seller.isSeller:true` — a DRAFT/rejected/deleted/suspended-seller gig 404s identically to a non-owned one (existence never revealed). **[H2, B2]**

### 3.3 Endpoints

**Categories** (public read, admin write)
| Method | Path | Auth | Service |
|---|---|---|---|
| GET | `/api/categories` | none | `categories.listTree()` (cached, `gigCount`) |
| POST/PATCH | `/api/categories[/[id]]` | ADMIN | `categories.create/update` (rename/reorder/deactivate/reparent §6) |

**Profile** (public read, owner write)
| Method | Path | Auth | Service |
|---|---|---|---|
| GET | `/api/creators/[slug]` | none | `profiles.getPublic(slug)` → profile + ACTIVE gigs page |
| GET/PATCH | `/api/me/profile` | isSeller | `profiles.getOwn/update` |
| POST | `/api/me/profile/portfolio` | isSeller | `profiles.addPortfolioItem` (body: `assetId,caption,position`) — cap `MAX_PORTFOLIO_ITEMS` [H3] |
| PATCH/DELETE | `/api/me/profile/portfolio/[id]` | isSeller | scoped via `portfolioItemWhereForUser` |

`ProfileUpdateSchema.strict()`: `headline?, bio?(≤600), skills?, aiTools?, languages?(allowlist), isAvailable?`. **Excluded:** `level, ratingAvg, ratingCount, completedOrders, slug` (slug change is a separate audited action). **[L1]**

**Gigs** (public read, owner write, admin moderate)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/gigs` | none | catalog; filters `categoryId,tag,minPriceUzs,maxPriceUzs,sort(new\|rating\|price_asc\|price_desc)`; cursor; ACTIVE only |
| GET | `/api/gigs/[id]` | none | full gig+packages+seller+translations; ACTIVE only |
| GET | `/api/me/gigs` | isSeller | all statuses; cursor |
| GET | `/api/me/gigs/[id]` | isSeller | scoped preview, any status |
| POST | `/api/me/gigs` | isSeller | DRAFT + packages + translations; **gig-cap enforced** [H2]; **idempotent** [L3] |
| PATCH | `/api/me/gigs/[id]` | isSeller | scoped; material change on ACTIVE → PENDING_REVIEW (§5); rate-limited `gig.update` [H4] |
| DELETE | `/api/me/gigs/[id]` | isSeller | soft-delete; blocked w/ non-terminal orders → CONFLICT |
| POST | `/api/me/gigs/[id]/{submit,pause,resume}` | isSeller | state machine §5 |
| GET | `/api/admin/gigs?status=PENDING_REVIEW` | ADMIN | moderation queue; cursor |
| POST | `/api/admin/gigs/[id]/{approve,reject}` | ADMIN | reject requires `reason` |
| POST | `/api/gigs/[id]/report` | auth (any user) | **user flag** for live gigs → moderation queue [C2] |

`GigCreateSchema.strict()` carries **intent only** (server derives `sellerId, slug, status=DRAFT, fromPriceUzs, *Url`):
```ts
{
  primaryLocale: z.enum(["uz","ru","en"]),
  categoryId: z.string().cuid(),
  tags: z.array(z.string().min(2).max(24)).max(8).default([]),
  coverAssetId: z.string().cuid().optional(),
  galleryAssetIds: z.array(z.string().cuid()).max(8).default([]),
  translations: z.array(z.object({
    locale: z.enum(["uz","ru","en"]),
    title: z.string().min(3).max(80),
    description: z.string().min(50).max(5000),
  }).strict()).min(1).max(3),                         // refine: primaryLocale present; locales unique [C1]
  packages: z.array(z.object({
    tier: z.nativeEnum(PackageTier),
    title: z.string().min(3).max(60),
    description: z.string().max(600).optional(),
    priceUzs: z.number().int().min(MIN).max(MAX),
    deliveryDays: z.number().int().min(1).max(90),
    revisions: z.number().int().min(-1).max(20).default(1),
    features: z.array(z.string().max(60)).max(10).default([]),
  }).strict()).min(1).max(3),                         // refine: tiers unique; BASIC required; price ascending
}.strict()
```

**Media**
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/media/presign` | isSeller | `Idempotency-Key` + body-hash; rate-limited; pending-cap + daily-cap [H5,M5] |
| POST | `/api/media/[id]/confirm` | isSeller | scoped; PENDING→UPLOADED + enqueue process |
| DELETE | `/api/media/[id]` | isSeller | scoped; → DELETED + enqueue purge; **audited** [L2] |

`PresignSchema.strict()`: `{ type, mimeType∈allowlist, sizeBytes:int≤cap, intent:"gig.cover"|"gig.gallery"|"portfolio" }`. **Visibility is server-set from intent** (always PUBLIC here; PRIVATE deliverables are a Phase-3 endpoint). Server generates `quarantineKey`, enforces caps by intent, `expiresAt=now+5min`, creates PENDING row, signs a PUT **to the quarantine bucket** pinning `Content-Type` only. **[C1, C2, H5]**

### 3.4 Service notes
- `gigs.create/update`: one `$transaction` (gig + packages + translations + asset attach + `fromPriceUzs` + `Category.gigCount ±` + `audit`). Attach validates **inside the tx**: `asset.ownerId===user.id AND status===READY AND attachedId IS NULL` (atomic — prevents stealing/double-attaching another row's asset). **[H3]**
- Slug: `slugify(title)`, retry `-2/-3…` on `(sellerId,slug)` collision within tx; honors the partial-unique (deleted rows don't block reuse). **[m5]**
- Package edit = retire-and-clone for tiers referenced by non-terminal orders, else upsert/delete. `recomputeFromPrice(tx, gigId)` after any package change. **[C3]**
- Rollups (`ratingAvg/Count`, `completedOrders`, `level`, `ordersCount`, `gigCount` reconcile) are **job/consumer-written**, never by these mutations or the client. Services throw `Errors.*`, never sentinels.
- `audit()` on: gig create/submit/approve/reject/pause/resume/softDelete, profile update (with before/after for PII fields — bio/headline are Personal-tier per DATA-PROTECTION §6), slug change, portfolio add/remove, media.softDelete, media.process, admin category writes. **[L2]**

---

## 4. Media upload pipeline (presigned → quarantine → validate → promote)

**Goal:** large AI files never transit Next.js; the app signs, validates, records. **No asset is publicly reachable until READY.** **[C2]**

```
client → POST /api/media/presign          (declares type/mime/size/intent; Idempotency-Key)
         server: requireSeller → pending-cap + daily-cap → cap-by-intent → gen quarantineKey
                 → MediaAsset(PENDING, expiresAt+5m) → sign PUT to QUARANTINE bucket (Content-Type pinned)
                 → { assetId, url, method:PUT, headers:{Content-Type}, maxBytes(advisory) }
client → PUT <url> directly to R2 quarantine bucket   (private; no public read)
client → POST /api/media/[id]/confirm      → scoped fetch (ownerId, PENDING) → UPLOADED → enqueue media.process
job media.process (idempotent; READY/REJECTED short-circuit):
   HEAD quarantine object → AUTHORITATIVE size check ≤ cap → over-cap ⇒ REJECTED + purge      [C1,H5]
   read bytes → MAGIC-BYTE sniff (file-type) → must match declared allowlist; SVG hard-denied  [C3]
   IMAGE: sharp re-encode (limitInputPixels=25e6, failOn:'truncated') → STRIP EXIF/GPS →
          generate webp thumbnails (400w/800w) → read w/h → write to PUBLIC bucket (content-hash key)
   VIDEO: ffprobe (dims/duration) → ffmpeg poster thumbnail → STRIP container metadata (re-mux);
          the raw upload is NEVER publicly served — only the cleaned transcode/poster                [M2-adv]
   compute sha256 → set storageKey + publicUrl (CDN base + storageKey) → status READY (else REJECTED+reason)
   audit("media.process", assetId)
attach (gig/portfolio): tx asserts {ownerId:self, READY, attachedId NULL} then copies publicUrl/thumbUrl.
```

**Defense in depth / verified platform facts:**
- **R2 has NO presigned-POST / no `content-length-range`** (EVIDENCE, R2 docs). The "Content-Length pinned by signature" claim from the drafts is **false on R2 and is removed everywhere.** Size is enforced **only** by the post-upload HEAD; the quarantine bucket bounds blast radius; presign rate-limit + 5-min expiry + `MAX_PENDING_ASSETS` + `PRESIGN_DAILY_CAP` bound abuse; `media.gc` runs frequently (≤15 min) or event-driven on object-create. **[C1, H5]**
- **SVG hard-denied** at presign allowlist (`image/jpeg|png|webp`, `video/mp4|webm|quicktime`) and at the sniff step (allowlist, not `image/*`); `sharp` re-encode rasterizes/strips any embedded script. **[C3]**
- **Public media served from a cookieless domain** distinct from the app origin, with `X-Content-Type-Options: nosniff` and `Content-Disposition` set; public bucket has **no list permission**, objects content-hash-named (no enumeration). **[C2, C3]**
- **EXIF/GPS strip is fail-closed**: no READY without it; images via `sharp`, videos via re-mux (raw original never served). **[M2-adv]**
- **Presigned URLs are secrets:** never logged, never returned in an error envelope; treated as bearer tokens. **[C1]**
- **No "import from URL"** in Phase 2 (the `media_import_url` MCP tool is NOT wired). If ever added it MUST carry the EVIDENCE SSRF controls (allowlist + final-IP validation blocking RFC1918/`169.254.169.254`/loopback + no redirect-follow + size/timeout cap). **[M4-adv]**

**GC (`media.gc`):** PENDING-past-`expiresAt`, DELETED, and orphan READY (no `attachedId` > N days) → purge object+thumb from both buckets, hard-delete row. **CDN purge** is issued for any deleted public object (cache invalidation). **[M2]**

---

## 5. Gig lifecycle & moderation

`GigStatus = DRAFT | PENDING_REVIEW | ACTIVE | PAUSED | REJECTED` (add `PENDING_REVIEW`; `DELETED` handled by `deletedAt`).
```
DRAFT ──submit──▶ PENDING_REVIEW ──approve(admin)──▶ ACTIVE ──pause/resume(seller)──▶ PAUSED
  ▲                    │                                │
  └──(edit)── REJECTED ◀──reject(admin,reason)──────────┤
ACTIVE ──MATERIAL edit──▶ PENDING_REVIEW   (re-moderate; non-material edits stay ACTIVE)  [H4,M4]
any(non-DELETED) ──softDelete(blocked if non-terminal orders)──▶ deletedAt
```
- Only **ACTIVE** gigs appear publicly / take orders. Illegal transition → `CONFLICT`.
- **Material vs non-material edit [H4, M4]:** `MATERIAL_FIELDS = {title, description, category, package price, cover/gallery}` flip ACTIVE→PENDING_REVIEW. **Non-material** (`isAvailable`, tag reorder, feature text typo, gallery reorder) stay ACTIVE — prevents griefing rivals into review and per-keystroke re-queue from the manager's optimistic save. `gig.update` has its own rate-limit bucket.
- `approve/reject` ADMIN-only, set `moderatedAt/ById`, `audit()` every transition; `reject` requires `reason` (shown to seller). `publishedAt` set on **first** ACTIVE only (stable newest sort).
- **Editing while live (deferred limitation, named [H1-adv]):** at MVP a material edit pulls the gig from the catalog until re-approval. A **draft-overlay/version model** (approved version keeps serving while a draft copy is reviewed) is **deferred to a later phase** — §14.
- **Moderation is real, not a gate [C2]:** (a) **text screening** — banned-term list + contact-info/URL stripping on `title/description/bio/caption` (anti-escrow-bypass) at submit; (b) **image NSFW** — a worker classifier (self-hosted on the VPS today; ClamAV is weak on images so the primary control is mandatory `sharp` re-encode + NSFW model) runs in `media.process`; (c) **admin reviewer view** shows all translations, media, seller level, flag count, with an SLA target; (d) **user-report path** (`/api/gigs/[id]/report`) routes live gigs back to the queue. Auto-approve for trusted sellers (`level ≥ LEVEL_1`) calls `approve` as a system actor — the state machine stays the contract.

---

## 6. Category taxonomy management **[M1-adv]**
- **Deactivate** (`isActive=false`) hides a category without breaking FK; its gigs stay but drop out of active browse facets.
- **Reparent/delete:** deleting a parent with children is blocked unless children are reparented first; `Gig.categoryId` is `onDelete: SetNull` — on category removal, affected gigs are swept to an `Uncategorized` seed category by a maintenance action (not left null-and-orphaned), and the seller is notified to re-categorize.
- **Slug change** emits a 301 redirect entry (SEO continuity, §9). Admin taxonomy screen is a thin desktop CRUD (not specced screen-by-screen here).

---

## 7. i18n of gig content **[C1]**
- **Chrome** strings: `messages/{uz,ru,en}.json` keys; UZS via `formatUzs` at the edge; ICU plurals for `{n} days/revisions/reviews`; uz-Latin + uz-Cyrillic both verified.
- **Content** (`title/description`) via `GigTranslation`; resolve `requestedLocale → primaryLocale` fallback and **label the displayed language**. The wizard/manager lets a seller add ru/en translations (optional) or mark "auto-translate" (`source="auto"`, labelled). Search FTS uses `simple` config (no Uzbek stemmer — §2.8). **Package** content single-locale at MVP. **[C1, M6]**

---

## 8. UX / screens summary (per persona)

Design contract per screen: one filled primary; **money never bare** (escrow/fee line adjacent); thumb-zone primary at 360px; tested in the longest locale (uz/ru +15–35%) and uz-Cyrillic; empty/loading/error first-class; all copy i18n keys; logical properties (RTL-ready); inputs ≥16px; WCAG AA; focus trap/restore in every sheet/lightbox; status/level/"Popular" never color-only; `aria-live` on toasts/upload progress/price-on-tab-change; `prefers-reduced-motion` honored (GSAP only for the publish celebration).

| # | Screen · route | Persona | Essence + key gates |
|---|---|---|---|
| 1 | Public profile · `/creators/[slug]` | guest/buyer | Trust-legible: identity card, **languages-spoken above the fold**, level badge (localized + non-color), rating (`tabular-nums`, 1 dp, `(0)`≠NaN), portfolio (Screen 5), ACTIVE gigs grid (cursor), reviews rollup. 404 for non-seller/suspended/soft-deleted (existence hidden). `responseMins` null at launch → chip hidden, not "0m" [L4]. |
| 2 | Become-a-creator wizard · `/become-a-creator` | aspiring | Live gig in <5 min; 3 steps (who-you-are → first gig+samples → 3-package pricing); pre-gate `requireUser + onboardingCompleted`, redirect if already `isSeller`; autosave DRAFT survives login round-trip; **no KYC blocker** (dismissible "verify before payout"); finish = one `$transaction` (profile + `isSeller=true` + gig + ≤3 packages + ≥1 primary translation + portfolio) **idempotent** [L3]; net-after-fee line client-display-only (authoritative split server-side via `money.ts`). |
| 3 | Gig manager · `/dashboard/seller/gigs/{new,[id]/edit}` | active | `requireSeller` + `gigEditWhereForUser` (bare findUnique banned; non-owned→404); tabs Overview/Packages/Gallery/Status; explicit per-tab save w/ optimistic rollback; publish-readiness checklist (3 packages priced + cover + ≥1 portfolio + title); state machine §5; **non-material edits don't re-moderate** [H4]; `@@unique([gigId,tier,retiredAt])` surfaced as friendly error not 500. |
| 4 | Gig detail · `/gig/[id]` (slug cosmetic) | buyer | Conversion screen; SSR + indexable; ACTIVE only. Gallery (16:9 hero, AVIF/WebP, reserved ratio), package selector (real ARIA tablist; Standard "Popular" non-color cue; tab updates sticky price, `aria-live`), **money+escrow trust block adjacent to every price** (riskiest-assumption surface: ≥80% can restate "money held until delivery"), sticky "Continue · {price}" preserves tier across login round-trip; **language label** shown [C1]; LCP <2.5s/4G, CLS <0.05. |
| 5 | Portfolio gallery (component) | all | Read mode: ordered by `position`, mixed image/video (play affordance+poster), focus-trapped lightbox (prev/next, `Esc`, restore), lazy + reserved ratios. |
| 6 | Media upload UX · `/dashboard/seller/portfolio` | seller | Drag-drop + ≥48px tap target; per-file queued→uploading→processing→done→error(retry); client validation (type/size/count, friendly localized errors, no 500); reorder by drag + buttons + keyboard (SR-announced result [M3-adv]); offline-retry; cover via "Set as cover"; server stores only after READY (client URL never trusted); **portfolio cap** [H3]; **data-saver: video autoplay OFF by default** [M3-adv]. |
| 7 | Category browse · `/gigs[/[category]]` | discovery | Cursor-paginated (offset banned), ACTIVE only; localized category chips; responsive 1/2/3-col gig-card grid; card = lazy cover + seller row + clamp-2 title + rating `(count)` + **"dan {price} so'm"** + delivery chip (never truncates price/rating); filter bottom-sheet (focus-trapped, removable chips); invalid cursor → graceful page-1 reset. |

Riskiest assumption to validate first: buyers trust the Screen-4 trust block enough to pre-pay (escrow-comprehension test ≥80%); secondary: uz-Latin vs Cyrillic preference.

---

## 9. SEO / sitemap / structured data **[H6-adv]**
- **Canonical route resolved:** `/gig/<id>` is canonical (opaque id), `/creators/<slug>/<gigSlug>` optional cosmetic with `rel=canonical` → the id URL. Kills slug squatting/enumeration. **[M1]**
- **`sitemap.xml`** (paginated): ACTIVE gigs + ACTIVE seller profiles only; regenerated on moderation transitions. **`robots.txt`** disallows `/dashboard`, `/api`, non-ACTIVE.
- **`hreflang`** per locale (uz/ru/en) on gig + profile pages, driven by `GigTranslation` availability.
- **JSON-LD** `Product`/`Offer` (price = `fromPriceUzs`, currency UZS) + `AggregateRating` (when `ratingCount>0`) + `Person`/`ProfilePage`. **All text escaped for the meta/JSON-LD/OG context, not just React children** — `description/title` are plain-text-stored and escaped per output context (no "rich" text). **[M3]**

## 9b. Analytics events **[H7-adv]**
Minimal taxonomy to a privacy-aware sink (consent per DATA-PROTECTION): `gig_create_started`, `gig_create_step_completed{step}`, `gig_published`, `gig_view{gigId}`, `package_selected{tier}`, `continue_clicked{tier}`, `login_summoned`, `creator_onboard_completed`, `escrow_line_seen`. These instrument the <5-min-publish and escrow-comprehension success metrics — without them the spec's own targets are unmeasurable.

---

## 10. Scale design — numbers, indexes, caching, pagination

Sizing @ **100K users** (≈10% creators = **10K sellers**, ~5 gigs each):

| Table | Rows | Hot query | Index |
|---|---|---|---|
| SellerProfile | ~10K | profile by slug | `slug @unique` |
| Gig | ~50K (~30K ACTIVE) | catalog newest | `[status, publishedAt desc]` |
| | | category + price | `[categoryId, status, fromPriceUzs, id]` ✅ tiebreaker [M2] |
| | | top-rated | `[status, ratingAvg desc, id]` ✅ tiebreaker [M2] |
| | | **hot-seller profile grid** | `[sellerId, status, publishedAt desc]` ✅ sorted-in-index [M1] |
| GigPackage | ~150K+ (incl. retired) | packages of gig | `[gigId, retiredAt]` |
| GigTranslation | ~80K (≈1.6/gig) | gig content by locale | `@@unique([gigId, locale])` |
| MediaAsset | ~300K | owner assets / GC | `[ownerId,status]`, `[status,expiresAt]` |
| PortfolioItem | ~80K | profile gallery ordered | `[profileId, position]` |
| Category | ~50 | active tree | tiny, fully cached |

These are **small** for Postgres on one VPS; the scale concern is **read fan-out on catalog/profile pages**, solved by denormalization + indexes + caching, not sharding.

- **Cursor pagination (keyset, every list):** newest `orderBy [{publishedAt desc},{id desc}]`; price `[{fromPriceUzs},{id}]`; rating `[{ratingAvg desc},{id desc}]`. Cursor = base64url of the sort tuple. **Every sort tuple's tiebreaker `id` is in its index** so range scans don't degrade into large-bucket filters at the 50K floor-price clump. Fetch `limit+1`. Invalid cursor → `VALIDATION` → client resets to page 1. **[M2]**
- **Denormalization (the key move):** list cards render entirely from the `Gig` row (`coverThumbUrl, fromPriceUzs, ratingAvg/Count, ordersCount`, primary `title`, seller `level/slug`) — **zero joins** to packages/reviews/media/translations on the catalog read. Writes keep these fresh via the tx + recompute jobs (each audited).
- **Caching + invalidation:** categories tree (app-memory + Next fetch cache, long TTL, `revalidateTag("categories")` on admin write); gig page (`gig:<id>` tag, busted on update/transition); catalog RSC (60s + `gigs:catalog` tag, busted on approve/reject/pause/resume); asset `publicUrl` immutable+content-hashed → cache-forever at CDN. Same tags map to Redis at scale.
- **Counters** (`gigCount`, `ordersCount`, `ratingCount`) eventually-consistent via `±` deltas + nightly reconcile — never `COUNT(*)` on the hot path. **[m1]**
- **Media at scale:** uploads bypass the app (direct R2 PUT) so app CPU/bandwidth is flat vs file size; only cost is signing + the async `media.process` job (move to a dedicated worker queue at scale). 300K assets × ~2 derivatives is well within R2; quarantine + GC keep PENDING/orphan growth bounded.

**Background jobs (pg-boss, `server/jobs/`):** `media.process` (sniff/scan/sharp/ffmpeg → READY/REJECTED), `media.gc` (≤15-min cron + event-driven), `category.recount` (nightly reconcile), `gig.searchVectorRefresh` (on create/update or trigger). All idempotent; call services, never inline logic.

---

## 11. Security / threat model (STRIDE)

- **Assets:** seller PII (bio/headline = Personal-tier), public media, category catalog, integer-UZS prices. No Sensitive-tier PII here.
- **Entry points:** §3 routes; jobs `media.process/gc`, `category.recount`, `gig.searchVectorRefresh`.
- **Actors:** anon (read ACTIVE), buyer (read + report), seller/`isSeller`+ACTIVE (own profile/gigs/media), admin (categories + moderation).

| STRIDE | Control |
|---|---|
| **Spoofing** | signed session cookie only; presign/confirm gated by `requireSeller` (isSeller + status ACTIVE [H2]) + ownership |
| **Tampering** | price/status/slug/owner/`fromPriceUzs` server-derived; presigned PUT pins `Content-Type` (size **not** signable on R2 — HEAD-enforced post-upload [C1,H5]); magic-byte sniff overrides declared mime; SVG denied [C3]; images re-encoded; package edits append-only for ordered tiers [C3] |
| **Repudiation** | `audit()` on every gig transition, profile/PII update (before/after), slug change, portfolio + media mutations, media.process, admin category writes [L2] |
| **Info disclosure** | non-ACTIVE/soft-deleted/suspended-seller gigs+profiles 404 via scoped `where` [H2,B2]; quarantine vs public bucket split, public served cookieless w/ nosniff [C2,C3]; EXIF/GPS stripped fail-closed (image+video) [M2-adv]; plain-text + per-context escaping incl. JSON-LD/OG [M3]; no `dangerouslySetInnerHTML` |
| **DoS** | cursor pagination everywhere; rate-limit buckets `gig.create/update/submit`, `media.presign`, `gig.report`, `category`; gig-cap-by-level + portfolio-cap + pending-asset-cap + presign-daily-cap [H2,H3,H5]; upload bytes go to R2 not the app; presign 5-min expiry + frequent GC |
| **Elevation** | moderation ADMIN-only; buyer cannot create gigs (isSeller gate); cross-seller edit/attach blocked by scoped `where` + atomic in-tx ownership assert [H3] |

**Negative tests (CI-blocking):** A↛edit/delete/attach B's gig/asset/portfolio →404; buyer↛create gig →403; suspended seller↛any mutation →403 [H2]; public GET of DRAFT/PENDING/REJECTED/deleted/suspended-seller gig →404; confirm of another user's asset →404; unknown body key →422; illegal transition (resume a DRAFT) →409; attach a non-READY or non-owned asset →error; oversized object → REJECTED post-upload [C1]; SVG → REJECTED [C3]; same idempotency key + different body →409 [M5].

---

## 12. Verification gates — executable test stubs

Named tests + exact assertions. Coverage ≥80%; **authz builders + state machine 100% branch.**

### 12.1 Vitest unit
```
authz.requireSeller.spec.ts
  ✓ ACTIVE isSeller → passes
  ✓ isSeller=false → throws FORBIDDEN
  ✓ status=SUSPENDED + isSeller=true → throws FORBIDDEN            [H2]
  ✓ admin bypass where-builders return {id} only
authz.whereBuilders.spec.ts
  ✓ gigOwnWhereForUser non-admin → {id, sellerId:self, deletedAt:null}
  ✓ mediaWhereForUser non-admin → {id, ownerId:self}
  ✓ portfolioItemWhereForUser non-admin → {id, profile:{userId:self}}
slug.spec.ts            ✓ slugify; ✓ collision appends -2/-3; ✓ reuses slug freed by soft-delete (partial-unique) [m5]
money.spec.ts           ✓ formatUzs thousands; ✓ commissionSplit(50_000,20%)=> {commission:10_000, net:40_000} integer [M4]
gigStateMachine.spec.ts ✓ all legal edges; ✓ every illegal edge throws CONFLICT (100% branch)
materialChange.spec.ts  ✓ title/desc/category/price/cover/gallery ⇒ re-moderate; ✓ isAvailable/tag-reorder/feature-typo ⇒ stays ACTIVE [H4]
schemas.spec.ts         ✓ .strict() rejects unknown key →422 (incl. level/ratingAvg in ProfileUpdate) [L1]; ✓ price<MIN / non-int / negative rejected; ✓ tiers-unique + BASIC-required + ascending refine; ✓ SVG mime rejected at presign [C3]; ✓ translations require primaryLocale [C1]
idempotency.spec.ts     ✓ same key+body → cached; ✓ same key+different body → CONFLICT [M5]; ✓ stale presign re-signed [m2]
mediaValidate.spec.ts   ✓ declared image/png but PNG-magic-byte mismatch → REJECTED; ✓ over-cap HEAD → REJECTED+purge [C1,H5]
```

### 12.2 Vitest integration (real test DB)
```
gigCreate.int.ts
  ✓ create writes gig + ≤3 packages + ≥1 translation + attaches READY cover in ONE tx; fromPriceUzs=min(price); gigCount+1; audit row
  ✓ create rejected when seller at gig-cap-for-level [H2]
  ✓ create is idempotent: same Idempotency-Key twice → one gig [L3]
attachAsset.int.ts
  ✓ attach asset owned by self+READY → succeeds, copies publicUrl
  ✗ attach another user's READY asset → error (in-tx ownerId assert) [H3]
  ✗ attach PENDING/UPLOADED asset → error (READY gate) [C2]
  ✗ double-attach an already-attached asset → error [H3]
packageEdit.int.ts
  ✓ material price edit on tier with a non-terminal order RETIRES old row + clones new; old order still resolves snapshot [C3]
  ✗ hard-delete of an ordered package → blocked
moderation.int.ts
  ✓ submit DRAFT→PENDING_REVIEW; approve→ACTIVE sets publishedAt+moderatedBy+audit; gigCount+1
  ✓ material edit of ACTIVE → PENDING_REVIEW + removed from catalog; in-flight order unaffected [H4]
  ✓ reject requires reason; surfaced to seller
  ✓ report on ACTIVE gig enqueues moderation [C2]
publicScope.int.ts
  ✗ getPublic on DRAFT/PENDING/REJECTED/deleted gig → 404
  ✗ getPublic on gig whose seller.status=SUSPENDED → 404 [H2,B2]
  ✓ catalog returns ACTIVE-only; honors locale fallback + language label [C1]
i18nContent.int.ts
  ✓ ru request on uz-primary gig → ru translation if present, else uz + "Posted in" label [C1]
```

### 12.3 Playwright E2E
```
onboarding.e2e.ts        ✓ guest → become-a-creator → live/pending gig; autosave survives reload + login round-trip; no KYC blocker; one filled primary per step in uz/ru/en/uz-Cyrillic
gigDetail.e2e.ts         ✓ tab switch updates sticky price + delivery + revisions (aria-live); escrow line adjacent to every price; "Continue" preserves tier across login [riskiest-assumption surface]
catalog.e2e.ts           ✓ cursor "load more" no dupes/skips at price floor [M2]; invalid cursor recovers; price/rating never truncated
upload.e2e.ts            ✓ oversized/wrong-type rejected client-side (no 500); one file failing doesn't abort others; reorder by drag+buttons+keyboard SR-announced [M3-adv]; processing→cover gating
a11y.e2e.ts              ✓ keyboard path through wizard+manager+buy; lightbox/sheet focus trap+restore; AA contrast both themes; non-color level/Popular cues
```

### 12.4 k6 load (numbers)
```
catalog_browse.k6.js     target 200 RPS list+detail @30K ACTIVE gigs; p95 < 200ms; assert index-only (no seq scan) on all 4 sort paths [M1,M2]
profile_hotseller.k6.js  single TOP_RATED seller w/ 200 gigs, 300 VUs; p95 < 150ms; assert [sellerId,status,publishedAt] index used, no in-memory sort [M1]
presign_abuse.k6.js      one seller floods presign; assert rate-limit 429 after bucket + MAX_PENDING_ASSETS enforced; no unbounded R2 growth [H5]
```

---

## 13. Definition of Done
- [ ] **PRE-1** Identity v2 migrated (`grep BUYER|SELLER`=0); **PRE-2** `requireSeller`+`defineHandler({isSeller,rateLimit})`+typed `params`+`rate-limit/pagination/idempotency/media/slug/money` libs built & unit-tested.
- [ ] SCHEMA: Gig (PENDING_REVIEW, per-seller slug, moderation fields, rollups, searchVector, deletedAt), GigPackage (features/position/retiredAt append-only), GigTranslation, SellerProfile (slug/stats/isAvailable/deletedAt), PortfolioItem (assetId/enum), Category (tree/active/gigCount), MediaAsset (quarantine+public keys), IdempotencyKey (requestHash); expand/contract migrations + raw-SQL partial-unique + searchVector GIN.
- [ ] AUTHZ: new builders + `requireSeller` (suspension-aware) unit-tested 100% branch; public scoping excludes suspended sellers.
- [ ] MEDIA: presign→quarantine→sniff(no SVG)→size HEAD→re-encode/EXIF-strip→promote→READY; public/quarantine split; cookieless domain + nosniff; GC + CDN purge; NSFW + text screening.
- [ ] LIFECYCLE: state machine; material-vs-non-material; report flow; admin queue + SLA.
- [ ] i18n: GigTranslation + locale fallback + language label; chrome strings in `messages/*`.
- [ ] SEO+analytics: sitemap/robots/canonical(id)/hreflang/JSON-LD (escaped); event taxonomy wired.
- [ ] UI: 7 screens with loading/empty/error; UZS+dates at edge; AA + 360px in uz/ru/en/uz-Cyrillic.
- [ ] TESTS: §12 green; cross-tenant + suspended-seller + upload-abuse negatives CI-blocking; coverage ≥80% (authz/state-machine 100%).
- [ ] THREAT MODEL §11 done; structured logs + correlation id, no PII/secret/presigned-URL logging; audit rows verified.
- [ ] ADVERSARIAL: `security-review` + `qa-verifier` pass; VERIFY LIVE vs real DB + R2; SHIP via PR with green CI.

---

## 14. Deferred (explicit, not omitted)
- **Gig versioning / draft-overlay** — approved version keeps serving during edit review (Fiverr parity). MVP pulls gig to PENDING_REVIEW on material edit. **[H1-adv]**
- **`GigExtra` / add-ons** — first-class upsell entity (extra revision, commercial license, source files). EVIDENCE-recommended; deferred to a later catalog iteration. **[L1-adv, m4-adv]**
- **`GigPackageTranslation`** — per-locale package titles/features (MVP keeps packages single-locale). **[C1]**
- **Uzbek FTS stemmer / `pg_trgm` fuzzy + autocomplete** — MVP ships `simple` config; relevance spike is a Search-phase item. **[M6, L2]**
- **Per-request signed GET for PRIVATE deliverables** — Phase 3 (Orders); catalog never produces PRIVATE assets.
- **`responseMins`** — sourced from Messaging phase; chip hidden at launch. **[L4]**
- **Dedicated media worker queue / Cloudflare Images** — VPS-local `media.process` today; move at scale.

---

**Most load-bearing decisions:** (1) `GigTranslation` makes content multilingual — the product thesis, previously schema-blocked [C1]; (2) quarantine→promote with `publicUrl` written only at READY + SVG-denied + cookieless media domain [C2,C3]; (3) the false R2 "Content-Length-pinned" claim is removed — size is HEAD-enforced post-upload behind presign caps [C1,H5]; (4) append-only packages (`retiredAt`) keep dispute history intact for in-flight orders [C3]; (5) `requireSeller` gates on `isSeller` **and** `status===ACTIVE` [H2]; (6) tiebreaker `id` baked into every sort index + `[sellerId,status,publishedAt]` for the hot-seller page [M1,M2]; (7) Identity v2 + lib primitives are hard prerequisites, not footnotes [B1,H1].

**Key files:** `prisma/schema.prisma`, `src/lib/authz.ts` (builders + `requireSeller`, widened `UserLike`), `src/lib/handler.ts` (`isSeller`/`rateLimit`/`params`), `src/lib/env.ts` (price/media/cap/R2 keys), new `src/lib/{media,slug,pagination,idempotency,money,rate-limit}.ts`, new `src/server/services/{gigs,profiles,media,categories}.ts`, `src/server/jobs/{media-process,media-gc,category-recount,gig-search-refresh}.ts`, routes under `src/app/api/{categories,creators,gigs,media,me,admin}/**`, `messages/{uz,ru,en}.json`.
