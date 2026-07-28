# FreelanceAI

Central Asia's marketplace for AI creators — a Fiverr-style platform for buying and
selling AI-generated creative work (video, images), built Uzbekistan-first.

> **Cloning to continue?** Read [`docs/CONTINUE-HERE.md`](docs/CONTINUE-HERE.md) first —
> setup, which secret files to bring, current state, the open deploy-freshness issue to
> resume on, and pending work.

> Full product/architecture plan: see `~/.claude/plans/i-m-reaching-out-about-humming-rivest.md`.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS v4** + base shadcn-style components
- **next-intl** — i18n with locale-prefixed routes (`/uz` default, `/ru`, `/en`)
- **Prisma** + **PostgreSQL**
- **Vitest** for unit tests

## Prerequisites

- Node.js 22+ (developed on 24)
- A PostgreSQL database (see options below)

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   then edit .env and set DATABASE_URL (see "Database" below)

# 3. Generate the Prisma client
npm run prisma:generate

# 4. Apply the schema to your database
npm run prisma:migrate -- --name init

# 5. (optional) Seed categories
npm run db:seed

# 6. Run the dev server
npm run dev
# open http://localhost:3000  (redirects to /uz)
```

## Database

This project uses PostgreSQL (the schema relies on enums, arrays and JSON — SQLite
is not supported). Pick one:

- **Docker (local):** install Docker Desktop, then:
  ```bash
  docker compose up -d db
  # DATABASE_URL in .env.example already points at this container
  ```
- **Managed (no install):** create a free Postgres on Neon or Supabase and paste its
  connection string into `DATABASE_URL`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint (next config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:studio` | Prisma Studio (DB GUI) |
| `npm run db:seed` | Seed reference data (categories) |

## Project structure

```
src/
  app/[locale]/        # localized routes (home, gigs, sell, login)
  components/           # UI + layout components
  components/ui/        # base design-system primitives (button, ...)
  i18n/                 # next-intl routing, navigation, request config
  lib/                  # prisma client, utils
messages/              # uz.json / ru.json / en.json translation catalogs
prisma/                # schema.prisma + seed
```

## Roadmap

Built in verifiable phases (each ends at a demoable gate):

0. **Foundation** — scaffold, i18n, schema ✅
1. Identity — Telegram login (widget + Mini App), sessions, roles
2. Profiles & gigs
3. Discovery / search
4. Ordering lifecycle
5. Payments (Payme/Click) + double-entry ledger
6. Messaging & notifications
7. Reviews & reputation
8. Payouts (manual/assisted) + seller wallet
9. Disputes & admin / trust & safety
10. Multilingual rollout (RU/EN)
11. Growth features
12. (parallel) Legal & PSP partnership → automated escrow

## Money & compliance note

A non-bank may not hold client funds as e-money in Uzbekistan. v1 accepts payments
via licensed PSP rails (Payme/Click) and pays sellers via **manual/assisted card
payouts**, with an internal **accounting ledger** (not a spendable wallet). Automated
escrow/payouts come only after a PSP/bank agent agreement + local counsel sign-off.
