# FreelanceAI — Ops Runbook (Hostinger VPS)

Companion to [BUILD-SPEC.md](BUILD-SPEC.md) and [deploy-hostinger-vps.md](deploy-hostinger-vps.md)
(which has the initial Postgres setup). This is the production operations reference: sizing,
hardening, app deploy, backups, disaster recovery, and the security checklist.

> Prices/specs/templates change — **verify in hPanel**. Confidence notes at the bottom.

## 1. VPS sizing & region
- **Recommended: KVM 2 (2 vCPU / 8 GB / 100 GB NVMe).** A Next.js build can exceed 2 GB RAM; 8 GB
  gives Postgres real `shared_buffers` + headroom co-locating Postgres+Nginx+Node. KVM 1 (4 GB) only
  if you build in CI and ship the artifact (use Next `output:"standalone"`). Renewal ≈ +100% over promo.
- **OS:** clean **Ubuntu 24.04 LTS** (don't rely on bundled stack templates — configure a known,
  reproducible baseline).
- **Region:** no Central Asia DC. Pick **EU (Lithuania/Germany)** or **India (Mumbai, nearest to UZ)**.
  Region is fixed after setup. See data-law note in [DATA-PROTECTION §7](DATA-PROTECTION.md) — ordinary
  PII abroad is OK post-2026; keep backups in the same region.
- **Hostinger backups/snapshots:** weekly image backup (daily = paid); snapshots are single-slot,
  expire 20 days, manual. **Image backups are NOT application-consistent for a live Postgres** — use
  them only as a second layer; your `pg_dump` (§4) is the real DB backup. Note hPanel has its **own
  firewall** layer in addition to UFW — check both.

## 2. Server hardening baseline (run once, as root)
```bash
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
apt update && apt -y full-upgrade
# SSH: key-only, no root, no passwords (edit /etc/ssh/sshd_config.d/99-hardening.conf)
#   PermitRootLogin no / PasswordAuthentication no / PubkeyAuthentication yes / AllowUsers deploy
systemctl restart ssh    # TEST a new session in a separate terminal before closing!
# Firewall: default-deny inbound, only SSH/80/443 (NOT 5432)
ufw default deny incoming && ufw default allow outgoing
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable
# Brute-force + auto-updates + time
apt -y install fail2ban unattended-upgrades
systemctl enable --now fail2ban
dpkg-reconfigure --priority=low unattended-upgrades
timedatectl set-ntp true
```
Verify: `ufw status numbered`, `fail2ban-client status sshd`, password login refused.

## 3. PostgreSQL 16 (production)
- **Local-only:** `listen_addresses='localhost'`, `password_encryption=scram-sha-256`; `pg_hba.conf`
  allows only `127.0.0.1`/`::1` with scram; **5432 closed in UFW**. (Revert any dev `listen_addresses='*'`.)
- **Least-privilege roles** (see [DATA-PROTECTION §6](DATA-PROTECTION.md)): runtime `freelanceai_app`
  (no DELETE on append-only tables, no DDL); separate `freelanceai_migrate` for DDL; revoke `PUBLIC`.
- **Memory (8 GB):** `shared_buffers=2GB`, `effective_cache_size=5GB`, `work_mem=16MB`,
  `maintenance_work_mem=256MB`, `max_connections=50`, `wal_compression=on`. Use a **pooler** (PgBouncer
  txn mode, or conservative Prisma pool) instead of raising `max_connections`.

## 4. Backups (the part that actually matters)
Encrypted logical dumps, off-site, **tested**:
```bash
# /usr/local/bin/pg_backup.sh  (chmod 700)
set -euo pipefail; TS=$(date +%F_%H%M); DB=freelanceai
pg_dump -Fc "$DB" | gpg --encrypt --recipient backup@yourdomain \
  | aws s3 cp - "s3://your-bucket/pg/${DB}_${TS}.dump.gpg"   # any S3-compatible store, in-region
# crontab: 0 2 * * * /usr/local/bin/pg_backup.sh >> /var/log/pg_backup.log 2>&1
```
- GPG public-key encrypt (box never holds private key); **off-site** to S3-compatible storage **in the
  same region** as the DB (3-2-1 rule); retention ~14–30 daily + weekly tier.
- **Monthly restore drill (non-negotiable):** decrypt → `pg_restore` into a scratch DB → smoke-check
  key tables → drop. An untested backup is not a backup. Add a **heartbeat alert** so a silently-failing
  backup pages you.
- **PITR/pgBackRest:** not yet — daily encrypted dump + pre-change snapshot is the right start; adopt
  PITR when losing a day of data becomes unacceptable.

## 5. Nginx + TLS
Nginx terminates TLS, proxies to Next.js `:3000`. Key directives: `listen 443 ssl; http2 on;`,
TLS 1.2/1.3 only, `gzip on` (brotli needs `ngx_brotli` module — optional), security headers (HSTS,
`X-Content-Type-Options nosniff`, `X-Frame-Options SAMEORIGIN`, `Referrer-Policy`, CSP per app),
proxy headers (`Host`, `X-Forwarded-For`, `X-Forwarded-Proto`, Upgrade/Connection for SSE/WS).
**SSE route:** disable proxy buffering. TLS:
```bash
apt -y install certbot python3-certbot-nginx
certbot --nginx -d example.uz -d www.example.uz
certbot renew --dry-run   # confirm auto-renew
```

## 6. Running the app (PM2 + standalone)
**Recommendation for a solo founder: PM2 with Next.js `output:"standalone"`** (cluster mode, boot
persistence, log rotation, graceful reload). Docker becomes worth it once you add multiple services.
```bash
# next.config: output:"standalone"  → build in CI, ship the artifact (spares the box a heavy build)
npm i -g pm2
pm2 start ecosystem.config.js     # app (.next/standalone/server.js) + a worker process (pg-boss)
pm2 startup && pm2 save
pm2 install pm2-logrotate
pm2 reload freelanceai            # graceful, low-downtime redeploy
```
**Prisma migrations on deploy (safe):** (1) back up DB / snapshot first; (2) `npx prisma migrate deploy`
(never `migrate dev` in prod) using the **direct** (non-pooled) DB URL; (3) destructive changes use
**expand-contract** across separate deploys (add nullable → backfill → switch code → drop), never
rename/drop in one step.

## 7. CI/CD (GitHub → VPS)
GitHub-hosted runner builds/tests → `scp` standalone artifact → `ssh` runs `prisma migrate deploy` +
`pm2 reload`. Use **`appleboy/scp-action` + `ssh-action`**; store a **dedicated least-privilege deploy
key** + host in **GitHub Actions Secrets** (rotate ~90d). Restrict inbound SSH (runner ranges / jump
host / Tailscale) rather than leaving 22 open. Add to CI: `prisma migrate diff` drift check, gitleaks,
`npm audit`, coverage gate. Document a **rollback** (pm2 reload prior artifact, or restore snapshot).

## 8. Observability
- **Logs:** PM2 + `pm2-logrotate`; Nginx logs; structured JSON (pino) to disk is enough early.
- **Uptime:** external monitor (UptimeRobot, or self-host Uptime Kuma on a *different* host) hitting
  `/api/health` (returns DB + queue status). Heartbeat for the backup cron.
- **Errors:** Sentry/GlitchTip (start on free SaaS; self-host GlitchTip later if event volume demands).
- **Metrics:** node CPU/RAM/disk via hPanel or Netdata; full Prometheus/Grafana is overkill on one box.
- **Alerting:** wire uptime + error tracker + disk-full + backup-failure to email/Telegram.

## 9. Disaster-recovery runbook
1. **Before risky change:** Hostinger snapshot (20-day rollback) + on-demand `pg_dump`.
2. **App broken after deploy:** `pm2 reload` previous artifact, or restore snapshot.
3. **Data corruption / bad migration:** restore latest off-site encrypted dump into a fresh DB →
   validate key tables → repoint app (this is what the monthly drill rehearses).
4. **Box lost:** new VPS → run §2 hardening + stack → restore latest dump → restore artifact from
   CI/git → repoint DNS. RPO ≈ ≤24h with daily dumps (tighten with PITR later). Keep this runbook in repo; rehearse once.

## 10. Single-VPS security checklist
- [ ] Non-root `deploy` sudo user; root login disabled; SSH key-only; `AllowUsers deploy`.
- [ ] UFW default-deny; only 22/80/443; **5432 not exposed**; hPanel firewall consistent with UFW.
- [ ] fail2ban on sshd; `unattended-upgrades`; time sync.
- [ ] Postgres scram, least-priv runtime role (no superuser), separate migrate role, localhost-bound, pooled.
- [ ] LUKS on data volume; field encryption for sensitive tier; secrets in `chmod 600` env, never committed.
- [ ] TLS via certbot (auto-renew verified); HSTS + security headers; TLS 1.2/1.3 only.
- [ ] **Daily encrypted `pg_dump` off-site (in-region)** + Hostinger backup as second layer.
- [ ] **Monthly restore drill** + backup-failure heartbeat.
- [ ] External uptime + error tracking + disk-full alert; `/api/health` live.
- [ ] DR runbook rehearsed; CI has gitleaks/`npm audit`/migrate-drift; deploy key least-priv + rotated.
- [ ] Data-law reviewed with Uzbek counsel; no biometric/genetic data stored abroad.

## Confidence / verify-in-hPanel
High confidence: hardening, Nginx/TLS, Postgres tuning, Prisma `migrate deploy`+expand-contract, PM2,
backup/restore method. **Verify live:** Hostinger pricing/specs, template contents, and VPS region
availability (some DCs are web/cloud-only). **Counsel-dependent (time-sensitive):** exact post-27-Mar-2026
cross-border data conditions + operator registration.
