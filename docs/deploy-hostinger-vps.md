# Hostinger VPS — PostgreSQL + Next.js setup

This guide stands up the database now (so we can run migrations) and prepares the
same VPS to host the app later. Run the commands over SSH as `root` (Hostinger
gives you the VPS IP + root password in hPanel → VPS → SSH access).

> Assumes Ubuntu 22.04/24.04 (Hostinger's default VPS image). Replace
> `YOUR_STRONG_PASSWORD` and `YOUR_DEV_IP` with real values.

## 1. Connect & update

```bash
ssh root@YOUR_VPS_IP
apt update && apt upgrade -y
```

## 2. Install PostgreSQL 16

```bash
apt install -y postgresql postgresql-contrib
systemctl enable --now postgresql
psql --version   # confirm
```

## 3. Create the database and app user

```bash
sudo -u postgres psql <<'SQL'
CREATE USER freelanceai WITH PASSWORD 'YOUR_STRONG_PASSWORD';
CREATE DATABASE freelanceai OWNER freelanceai;
GRANT ALL PRIVILEGES ON DATABASE freelanceai TO freelanceai;
SQL
```

## 4. Allow remote connections (so we can migrate from your dev machine)

> If you later run the app **on this same VPS**, remote access is optional — the
> app connects over localhost. Enable it now for development convenience, and lock
> it down to your IP.

```bash
# Find the config dir (e.g. /etc/postgresql/16/main)
PGDIR=$(sudo -u postgres psql -tAc "SHOW config_file" | xargs dirname)

# Listen on all interfaces
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PGDIR/postgresql.conf"

# Allow your dev IP (scram-sha-256 = password auth). Restrict to YOUR_DEV_IP/32.
echo "host    freelanceai    freelanceai    YOUR_DEV_IP/32    scram-sha-256" >> "$PGDIR/pg_hba.conf"

systemctl restart postgresql
```

## 5. Firewall

```bash
apt install -y ufw
ufw allow OpenSSH
ufw allow 5432/tcp        # Postgres (only your IP can auth, per pg_hba above)
ufw --force enable
```

> Tip: find your dev IP with `curl -s https://api.ipify.org`. If your ISP IP
> changes, update the `pg_hba.conf` line and `systemctl restart postgresql`.

## 6. Connection string

Put this in your local `.env` (and later in the server's production env):

```
DATABASE_URL="postgresql://freelanceai:YOUR_STRONG_PASSWORD@YOUR_VPS_IP:5432/freelanceai?schema=public"
```

Then, from the project on your dev machine:

```bash
npm run prisma:migrate -- --name init   # creates tables
npm run db:seed                          # seeds categories
```

---

## Later: hosting the Next.js app on the same VPS

When we reach deployment, the app runs on this VPS behind Nginx:

```bash
# Node 22 (via nodesource) + pm2 + nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs nginx
npm i -g pm2

# In the deployed project dir:
npm ci && npm run build
pm2 start "npm start" --name freelanceai
pm2 save && pm2 startup

# Nginx reverse proxy :80 -> :3000, then add HTTPS with certbot.
```

A production checklist (HTTPS, backups, separate dev/prod DBs, secrets) will be
finalized in the deployment phase.

---

## What I need from you to apply the migration

1. The **connection string** from step 6 (or just the VPS IP + the DB password you
   set), so I can point `.env` at it and run `prisma migrate`.
   - Alternatively, share temporary SSH access and I'll run steps 1–5 for you.
2. For Phase 1 (Telegram login): a **bot token** from [@BotFather](https://t.me/BotFather)
   (`/newbot`) and the bot username. Treat the token like a password.
