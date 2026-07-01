# Ops runbook — backups, migrations, monitoring

## Database backups

Two independent layers:

1. **Nightly logical dumps (ours).** The `backup` sidecar in
   [deploy/docker-compose.prod.yml](../deploy/docker-compose.prod.yml) runs `pg_dump -Fc`
   immediately on every (re)start and then every 24h, uploading to the **private** R2
   bucket at `backups/db-<Weekday>.dump` (e.g. `backups/db-Mon.dump`). Weekday naming =
   7 rolling daily restore points, no cleanup job needed.
2. **Hostinger weekly VPS snapshots (automatic).** Whole-machine, ~weekly, restorable
   from hPanel / `VPS_restoreBackupV1`. Last resort only.

### Restore drill (rehearsed)

Run `deploy/restore-drill.ps1` — it spins a throwaway `restoredrill` compose project
on the VPS (scratch Postgres on tmpfs), downloads the newest weekday dump from R2,
`pg_restore`s it, and prints `[drill] RESULT users=… gigs=…` row counts to the project
logs. Read logs, compare counts to prod, then DELETE the `restoredrill` project.

- **Last drill: 2026-07-02 — PASS.** `db-Wed.dump` (88KB) restored with exit 0 /
  0 warnings; counts matched prod (users=13, gigs=22, profiles=12).
- Re-run the drill after any major schema change and before real-money launch.

### Restore procedure (logical dump)
1. Download the dump from R2 (S3 API, private bucket, key `backups/db-<Day>.dump`).
2. Copy it into the db container's host and run:
   ```
   pg_restore -h db -U freelanceai -d freelanceai --clean --if-exists db-<Day>.dump
   ```
   (e.g. via a one-off `postgres:16-alpine` container on the `freelanceai` compose
   network, `PGPASSWORD=$POSTGRES_PASSWORD`.)
3. Redeploy the app (`deploy/deploy-vps.ps1`) and run the verify suite.

## Migrations (no local database in this repo's dev setup)

Deploys run **`prisma migrate deploy`** from `prisma/migrations/` (the old
`db push --accept-data-loss` is gone). The pre-existing production DB is baselined:
the migrate service auto-resolves `0_init` as applied on first run (P3005 fallback).

**To change the schema:**
1. Edit `prisma/schema.prisma`.
2. Generate the migration SQL *without* a database:
   ```
   npx prisma migrate diff --from-migrations prisma/migrations \
     --to-schema-datamodel prisma/schema.prisma --script \
     > prisma/migrations/<YYYYMMDDHHMM>_<name>/migration.sql
   ```
   (create the folder first; name must sort after existing ones)
3. Review the SQL by hand — especially for data-destructive statements.
4. `npx prisma generate`, typecheck, commit, push, deploy as usual. The migrate
   service applies pending migrations before the app starts.

## Uptime monitoring

[.github/workflows/uptime.yml](../.github/workflows/uptime.yml) checks
`/api/health` (+ home page) every ~10 minutes from GitHub Actions. A failing run
triggers GitHub's failed-workflow notification to the repo owner — check that your
GitHub notification settings deliver Actions failures by email/app.

Note: GitHub cron isn't exact (runs can lag several minutes) and scheduled workflows
pause after 60 days without repo activity — fine while the project is actively
developed; move to a dedicated monitor (UptimeRobot etc.) at real-money launch.
