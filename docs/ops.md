# Ops runbook — firewall, backups, migrations, monitoring

## Deploys & rollback

Every deploy is **pinned to one commit** and **pull-based**: pushing to main triggers the
`image` workflow, which builds `ghcr.io/akmalidinalimov/freelanceai:<sha>` (public
package). `deploy/deploy-vps.ps1` resolves origin/main's tip SHA, **waits for that
image to exist in GHCR**, then swaps the compose project — the app and migrate
containers just pull the image (no git/npm/build on the VPS; restarts don't depend on
npm/GitHub being up). Build-time values (S3_PUBLIC_BASE_URL for the next/image
allowlist, NEXT_PUBLIC_BRAND_*) are GitHub Actions repo VARIABLES fed in as build args
— note anything DB-backed must NOT be statically prerendered (CI builds against a dummy
DATABASE_URL; that's why sitemap.ts is force-dynamic).

**Rollback** = redeploy a known-good commit:
```
& .\deploy\deploy-vps.ps1 -Sha <previous-good-sha>
```
(find SHAs with `git log --oneline`; the post-deploy verify suite still runs).

## Network posture (firewall)

**Drop-ALL-inbound** since 2026-07-02: Hostinger network-level firewall `freelanceai-prod`
(id 321306) is active on VM 1411263 with **zero allow rules** — every inbound connection
(incl. SSH:22) is dropped before reaching the box. This works because nothing needs
inbound: the site is served via the *outbound* Cloudflare Tunnel, Postgres is
compose-internal, and all operations (deploys, logs, backups, break-glass projects) go
through the Hostinger API.

**Emergency SSH re-open** (if ever needed): the firewall is managed above the VM, so you
can't be locked out of changing it —
`VPS_createFirewallRuleV1` (firewallId 321306, protocol SSH, port 22, source any or
your-IP) then `VPS_syncFirewallV1(321306, 1411263)`; or hPanel → VPS → Security →
Firewall. Delete the rule + re-sync when done. Console access without SSH: hPanel
browser terminal / recovery mode.

## Database backups

Two independent layers:

1. **Nightly logical dumps (ours).** The `backup` sidecar in
   [deploy/docker-compose.prod.yml](../deploy/docker-compose.prod.yml) runs `pg_dump -Fc`
   immediately on every (re)start and then every 24h, uploading to the **private** R2
   bucket at `backups/db-<Weekday>.dump` (e.g. `backups/db-Mon.dump`). Weekday naming =
   7 rolling daily restore points, no cleanup job needed. Each dump ALSO lands in a
   monthly slot `backups/db-<YYYY-MM>.dump` — long-term retention for
   corruption-noticed-late scenarios (delete old months manually if space matters).
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

### Restore to production (DESTRUCTIVE — break glass)
There is no SSH; restore is run as a one-off compose project that joins the prod network.
Use [deploy/restore-to-prod-compose.yml](../deploy/restore-to-prod-compose.yml):
1. Create a one-off Hostinger project named **`restoretoprod`** from that file.
2. Set project env: `POSTGRES_PASSWORD` + the four `S3_*` vars (same as prod), and the
   safety latch `CONFIRM=RESTORE`.
3. Start it; read the project logs for `[restore] pg_restore exit=0`. It pulls the newest
   of the last 7 weekday dumps and `pg_restore --clean --if-exists` into the live DB.
4. Run `deploy/deploy-vps.ps1` (verify suite), confirm the app, then **DELETE** the project.

The non-destructive rehearsal (`deploy/restore-drill.ps1`, scratch tmpfs DB) shares the
same download logic, so a green drill is evidence this path works.

## Migrations (no local database in this repo's dev setup)

Deploys run **`prisma migrate deploy`** from `prisma/migrations/` (the old
`db push --accept-data-loss` is gone). The pre-existing production DB is baselined:
the migrate service auto-resolves `0_init` as applied on first run (P3005 fallback).

**To change the schema:**
1. Edit `prisma/schema.prisma`.
2. Generate the migration SQL *without* a database — diff the pre-edit schema (from
   git) against the edited one (`--from-migrations` would need a shadow DB):
   ```
   git show HEAD:prisma/schema.prisma > /tmp/old-schema.prisma
   npx prisma migrate diff --from-schema-datamodel /tmp/old-schema.prisma \
     --to-schema-datamodel prisma/schema.prisma --script \
     > prisma/migrations/<YYYYMMDD>_<name>/migration.sql
   ```
   (create the folder first; name must sort after existing ones; commit the schema
   edit and its migration together so HEAD stays a valid "from" for the next one)
3. Review the SQL by hand — especially for data-destructive statements.
4. `npx prisma generate`, typecheck, commit, push, deploy as usual. The migrate
   service applies pending migrations before the app starts.

The P3005 baseline fallback fires **only** when the deploy error is actually P3005
(existing non-empty DB) — any other migrate failure aborts the deploy with exit 1 rather
than falsely marking migrations applied.

### Failed migration recovery (break glass)
If a migration fails partway, Prisma marks it failed and every later deploy aborts with
P3009 (app never starts → site down). Since there's no SSH, clear it with a one-off
project from [deploy/migrate-fix-compose.yml](../deploy/migrate-fix-compose.yml):
1. Create a one-off Hostinger project named **`migratefix`** from that file.
2. Set project env `POSTGRES_PASSWORD`. Start it once with `MIGRATION_NAME` empty to make
   it print `prisma migrate status` in the logs and read the failed migration's name.
3. Set `MIGRATION_NAME=<that name>`, start again — it runs `migrate resolve --rolled-back`.
4. Fix the migration SQL in the repo, push, redeploy prod, then **DELETE** the project.

## Uptime monitoring

[.github/workflows/uptime.yml](../.github/workflows/uptime.yml) checks
`/api/health` (+ home page) every ~10 minutes from GitHub Actions. A failing run
triggers GitHub's failed-workflow notification to the repo owner — check that your
GitHub notification settings deliver Actions failures by email/app.

Note: GitHub cron isn't exact (runs can lag several minutes) and scheduled workflows
pause after 60 days without repo activity — fine while the project is actively
developed; move to a dedicated monitor (UptimeRobot etc.) at real-money launch.
