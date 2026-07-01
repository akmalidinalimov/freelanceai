# Contributing — two-track workflow

Two teams work in parallel without conflicts by owning separate territories.
Conflicts happen at the file level, so this map is the contract.

## Ownership map

| Territory | Paths | Owner |
|---|---|---|
| **Frontend** | `src/components/**`, `src/app/[locale]/**` (pages), `src/app/globals.css`, `messages/*.json`, design mockups (`design-*.html`, `mock-assets/`) | UI team |
| **Backend / infra** | `src/server/**`, `src/app/api/**`, `src/lib/**`, `prisma/**`, `deploy/**`, `.github/**`, `docs/**` | Platform team |
| **Shared — announce before touching** | `src/app/[locale]/layout.tsx`, `package.json` / lockfile, `next.config.ts`, `.env*` handling | coordinate first |

## Branch model

- **`main` is production.** Every deploy clones `main`; the migrate container applies
  `prisma/migrations` from `main`. Therefore `main` must always be shippable.
- **UI team → `ui-redesign` branch.** Long-lived during the redesign; rebase on `main`
  daily (backend merges are small, rebases stay trivial); merge to `main` when the
  design is cohesive enough to go live.
- **Platform team → small complete batches to `main`.** Each batch typecheck + build
  clean, then deployed with the post-deploy verify suite (smoke + deep sweep + R2).

## Ground rules

1. Respect the ownership map; ping the other team before touching a shared file.
2. `messages/*.json` is the one file class both sides edit: **additive-only**, each
   side adds keys under its own namespaces, merge/rebase frequently.
3. Backend keeps **API response shapes stable** while the redesign is in flight —
   new fields are additive; nothing renamed or removed without a heads-up.
4. Schema changes: platform team only, via `prisma/migrations` (see
   [docs/ops.md](docs/ops.md) for the no-local-DB migration workflow). Never
   `db push` against prod.
5. Only `main` deploys. After merging to `main`, run `deploy/deploy-vps.ps1`
   (auto-runs the 115-check verification) — a merge isn't "done" until it's green.
6. Secrets live only in git-ignored files (`.env.deploy.local`, `.mcp.json`);
   never committed, never printed in logs or PRs.

## Definition of done (both tracks)

Typecheck clean → build clean → (backend: deploy + verify green | UI: rebased,
no page ships with content hidden behind un-fired animations, contrast ≥ 4.5:1,
works at 390px) → pushed.
