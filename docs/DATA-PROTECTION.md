# FreelanceAI — Data Protection & Compliance

Companion to [BUILD-SPEC.md](BUILD-SPEC.md). How we protect client/user data, specific to our
Prisma schema and stack. This is the security spine for every money/PII feature.

## 1. PII classification (drives handling)
| Tier | Fields (model) | Handling |
|---|---|---|
| **Sensitive/regulated** | `PayoutRequest.cardMasked`, payout receipts, `Transaction.rawPayload`, `User.phone` | Field-level encrypt; strict RBAC; audit every read; never log. **Full PAN never stored** (schema keeps only masked). |
| **Personal (PII)** | `User.{telegramId,username,firstName,lastName,photoUrl,phone,locale}`, `Session` | Disk-encrypted at rest, access-controlled, localization-scoped (§7). |
| **Quasi-sensitive** | `Message.body/fileUrls`, `OrderDelivery.fileUrls`, `Dispute.reason`, order `requirements` | Private to participants; signed URLs for files; moderation hooks. |
| **Operational (integrity)** | `AuditLog`, `LedgerEntry`, `Order` amounts | Append-only, tamper-evident. |
| **Public** | `Gig`, `GigPackage`, `SellerProfile` public fields, `Review`, `Category` | Public read; validate/sanitize on write. |

Convention: mark schema fields `// @pii` / `// @sensitive`; keep a generated data-map for the localization/DPIA file.

## 2. Encryption
- **In transit:** TLS 1.2/1.3 everywhere (Nginx + Let's Encrypt, HSTS). App↔Postgres on localhost;
  if DB ever moves off-box → `sslmode=verify-full`.
- **At rest (disk):** **LUKS** on the Postgres data volume (protects against disk/image theft;
  stock Postgres has no TDE).
- **At rest (field):** **AES-256-GCM** for the Sensitive tier via `src/lib/crypto/field.ts`
  (store `{iv,tag,ciphertext}`, key-version prefix for rotation). Key = `DATA_ENC_KEY`, separate
  from `SESSION_SECRET`. Defends against a read-only DB/SQLi leak even with disk mounted.
- **Backups:** encrypted (GPG public-key) — see [OPS-RUNBOOK](OPS-RUNBOOK.md).

## 3. Secrets
- Secrets are server-only; only the bot **username** is `NEXT_PUBLIC_*`.
- VPS: `.env.production` owned by app user, `chmod 600`, outside git + web root; loaded via PM2 ecosystem.
- **Boot-time zod env validation** (`src/lib/env.ts`) — refuse to start on missing/weak
  `SESSION_SECRET`/`TELEGRAM_BOT_TOKEN`/`DATA_ENC_KEY`/PSP keys.
- CI: **gitleaks** + `npm audit`/`osv-scanner`, block on findings. Key-rotation runbook (versioned
  `DATA_ENC_KEY` so rotation doesn't require bulk re-encrypt).

## 4. AuthZ & IDOR prevention (highest-risk gap — land in P1.5)
`requireUser()` only authenticates today. Add authorization before any multi-user data route.
Most rules here are **relationship-based**, not just role-based.

**Ownership matrix (enforce in the service layer; never trust client-supplied ids):**
| Resource | Read | Mutate |
|---|---|---|
| `Order` | buyer==me OR seller==me OR admin | role-in-order gated transition |
| `Message`/`Conversation` | order participants only | sender==me |
| `OrderDelivery` files | participants only (signed URL) | seller of order |
| `PayoutRequest` | seller==me OR admin | seller create; **admin** approve/pay |
| `Dispute` | participants + admin | admin resolve |
| `Gig` edit | owner OR admin | owner |
| `Review` | public | author == buyer of a **COMPLETED** order, one per order |

**IDOR pattern — scoped queries are the only way to fetch owned data:**
1. Never `findUnique({where:{id}})`-then-check. Use `findFirst({where:{id, OR:[{buyerId:me},{sellerId:me}]}})`
   → non-owned id returns `null` → **404** (don't reveal existence). Wrap as `getOrderForUser(id,user)`.
2. `requireRole(user,'ADMIN')` + `requireOrderParticipant()` helpers, mandatory on money/PII routes.
3. Opaque cuid ids (not sequential) — good, but not a control; still scope.
4. **Mass-assignment guard:** zod `.strict()`; never spread `req.body` into Prisma; derive
   `buyerId/amountUzs/commissionUzs` server-side from gig/package, never from input.
5. **Cross-tenant negative tests are mandatory** (A cannot read/mutate B's order/messages/payout).

## 5. Input validation, rate limiting, abuse
- **zod at every trust boundary** (handlers, server actions, webhooks); `.strict()`; validate path
  params (cuid shape). React escaping on output; forbid `dangerouslySetInnerHTML` on user content.
- **Rate limiting** (`src/lib/rate-limit.ts`) on auth callback, message send, order create, payout,
  search, webhooks — key by user+IP (in-memory/pg now, Redis later).
- **Webhooks:** verify Payme Basic-auth/Click signature **before** any work; idempotency on
  `idempotencyKey`; **never trust amounts** from the webhook — reconcile against the `Order`.
- **Abuse:** off-platform contact scrubbing in chat (P9), upload caps, gigs/day cap, account-age gate on payout.

## 6. Audit, DB hardening, retention
- **Audit (`src/lib/audit.ts`)** on login, role change, gig moderation, every order transition, every
  ledger posting, payout approve/pay, dispute resolution, impersonation, export/erasure. Store
  actor+IP+before/after for money rows. **Append-only** (app DB role lacks UPDATE/DELETE on it).
- **DB least-privilege** (tighten the deploy doc's `GRANT ALL`):
  - `freelanceai_app` (runtime): SELECT/INSERT/UPDATE on business tables; **no DELETE** on
    `AuditLog`/`LedgerEntry`/`Transaction`; no DDL. Revoke `PUBLIC` schema privs.
  - `freelanceai_migrate` (DDL/migrations only; used by `prisma migrate deploy`, not the app).
  - **Postgres bound to localhost; 5432 not exposed** (revert the dev `listen_addresses='*'` for prod).
    Prisma pool ~5–10, statement + idle-in-transaction timeouts. RLS optional later.
- **Retention/rights:** soft-delete (`deletedAt`) + anonymization (null PII, keep ledger rows for
  accounting); prune `rawPayload` after reconciliation; session purge job. **Data export**
  (`exportUserData`) + **erasure** (`anonymizeUser`, preserves financial integrity), identity-gated, audited.
  Record ToS/Privacy acceptance + version on the User.

## 7. Uzbekistan data-localization (UPDATED — decide region now)
- Base law: «О персональных данных» **ZRU-547 (2019)**; 2021 **ZRU-666** imposed strict in-country
  localization. **As of 27 March 2026, this was significantly relaxed:** ordinary personal data of
  Uzbek citizens **may be stored/processed abroad under conditions.** **Still mandatory in-UZ:
  biometric, genetic, and telecom-subscriber data.**
- **Implication:** a marketplace processing names/contacts/profile/payment identifiers is *ordinary*
  PII → hosting on **Hostinger EU (Lithuania/Germany) or India (Mumbai, nearest to UZ)** is **likely
  defensible post-2026**, subject to meeting the conditions. Hostinger has **no Central Asia DC**.
  → **Do NOT collect biometric/genetic data** (or segregate it to a UZ-resident provider if KYC ever
  needs it). Keep card data on the licensed PSP (we already store no PAN).
- **Caveat:** law is very recent; sources conflict on the exact cross-border conditions (three
  cumulative conditions vs adequacy/SCC alternatives) and on operator-registration duty. **Confirm
  operative text + registration with Uzbek counsel before public launch (P12).** Record the chosen
  region + rationale in an ADR. Backups must follow the same region rule.

## 8. Incident response (basics)
Runbook: detect (error tracker + uptime + audit) → contain (rotate `SESSION_SECRET` = mass logout,
rotate leaked keys, revoke sessions) → eradicate → recover (restore from encrypted backup) → notify
(per UZ breach-notification duty — confirm timeline with counsel). Snapshot `AuditLog` as evidence.

## 9. Verification
- Field crypto round-trip test; ciphertext≠plaintext in DB; key-version honored on rotate.
- `testssl.sh`/`nmap`: A grade, TLS1.0/1.1 disabled, 5432 not internet-reachable.
- **Cross-tenant authz negative tests** green before P4 ships.
- App DB role lacks DELETE on append-only tables (negative SQL test).
- Backup is encrypted (can't restore without key) + **tested restore** (see OPS-RUNBOOK).
- Data-export returns a user's data; erasure anonymizes PII while ledger rows persist.
- Datacenter-country confirmed in writing; data-map reviewed by counsel; operator registration filed.
