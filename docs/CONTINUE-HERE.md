# Continue here — clone & resume guide

Last updated: 2026-07-13. Everything below is on `main` (`git log` for exact SHAs).

## 1. Fresh-clone setup

```bash
git clone https://github.com/akmalidinalimov/freelanceai.git
cd freelanceai
npm ci
cp .env.example .env.local        # then fill values (see §2)
docker compose up -d db           # local Postgres (pgvector image)
npm run prisma:generate
npx prisma migrate deploy         # applies all prisma/migrations
npm run dev                       # http://localhost:3000
```

Checks: `npm run typecheck` · `npm run lint` · `npm test` (unit) ·
`npm run test:integration` (needs the Postgres container).

## 2. Secrets are NOT in the repo — bring them separately

These are git-ignored and must be copied from your secure store to the new machine
(never commit them):

| File | Holds | Needed for |
|---|---|---|
| `.env.local` | app env (fill from `.env.example`) | running the app |
| `.env.deploy.local` | Hostinger/deploy secrets | `deploy/deploy-vps.ps1` |
| `.mcp.json` | Hostinger API token (+ MCP servers) | deploy script + MCP tools |

`.env.example` (just expanded) documents every var the code reads, grouped, with which
are optional for a first local run. The app degrades gracefully when optional keys are
unset (AI search → deterministic fallback, private bucket → public, etc.).

## 3. Where things stand (all live on https://gigora.ai unless noted)

Shipped + deployed this cycle:
- **Robustness:** atomic order/ledger claims, Payme reversal + double-charge partial index,
  coupon atomicity, upload size + private-bucket proxy, rate-limiter seam, error-alert seam.
- **Seller UX:** avatar feature, AI gig wizard (Claude), tag autocomplete, cover fallback,
  income nudge, unified profile-strength checklist, guided **submit-for-approval** flow +
  auto-nudge when eligible.
- **Instagram:** no-API portfolio — paste @handle + post links → embedded via `/embed`
  (CSP `frame-src` allows instagram.com). OAuth auto-sync remains for when Meta approves.
- **Buyer trust:** escrow "held until you accept" strip on active orders, **auto-accept date**
  disclosure, accept-confirm dialog, verified-badge now gated on real KYC.
- **Search:** Cyrillic↔Latin fold (`src/lib/translit.ts`) in the matcher + catalog.

## 4. ⚠️ OPEN ISSUE — resume here first

**Prod deploy-freshness is unconfirmed.** The cross-script search fold is proven correct by a
unit test locally, but the live AI-match API (`/api/search/match`) returns an intent the current
code cannot produce (`terms:[]` for "видео") — with **no caching** in that path. This strongly
suggests the running container may be serving **stale match-service code**, even though
`deploy/deploy-vps.ps1` + `verify-prod.mjs` report success (verify checks generic behavior, not
these specific changes). Consequence: the buyer-trust / submit-flow / search work "deployed"
after the Instagram commit (`6ce1179`) may **not actually be live**.

**Do this first on resume:**
1. On the VPS: `docker compose ps` + compare the app container's image digest to
   `ghcr.io/akmalidinalimov/freelanceai:<HEAD sha>`; check `docker compose logs` restart time.
2. **Recommended fix that makes this self-diagnosing:** set `APP_VERSION` = the deploy SHA in the
   prod compose env, so `/api/health` reports the *running* commit (it currently says `"dev"`,
   which is why remote deploy-verification is impossible). Then every deploy is verifiable.

## 5. Pending work (prioritized)

**Buyer side (audit in the session; top items):**
- Unify the two discovery cards (hero AI vs catalog) into one contract.
- Buyer first-order primer on "buy" intent (currently dumps at a raw gig grid); add a PAID
  timeline state + "waiting on seller, delivery by {date}" card; add Orders/Saved to mobile nav.
- Localize order/message notifications (currently hardcoded Uzbek even for ru/en buyers).

**Pre-payments launch (mostly ops/your action — grep `FREE_ORDERS`, `DEMO`):**
- Remove `FREE_ORDERS=1`; reset demo stats (`prisma/seed-demo-stats.mjs`, `match.ts` salesCount
  fallback); run Payme sandbox certification; provision Redis for `RATE_LIMIT_BACKEND`; set
  `ERROR_ALERT_WEBHOOK`; resolve `docs/adr/ADR-001` (data residency) with counsel; daily backups.

## 6. Deploy + verify workflow

Push to `main` → GitHub `image` workflow builds `ghcr.io/…/freelanceai:<full-sha>` (wait for it)
→ `pwsh deploy/deploy-vps.ps1` (deploys the tip, runs `prisma migrate deploy`, then
`verify-prod.mjs` = smoke + deep sweep + R2). Rollback: `deploy/deploy-vps.ps1 -Sha <old>`.
Also: `node deploy/test-r2.mjs`, `test-r2-private.mjs`, `e2e-prod.mjs`.

Note: `git push` can hang on a slow link via the credential manager — see
`docs/reference-gh-cli-quirks` pattern (token-in-URL push).
