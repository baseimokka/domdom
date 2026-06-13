# DomDom Store — Production Deployment Guide

Deployment of the **DomDom makeup e-commerce store** to a **Hostinger VPS (KVM 2 / Ubuntu)** using **Nginx + PM2 + MySQL + Let's Encrypt**.

This guide is written specifically for *this* codebase. Architecture as inspected:

| Layer | Detail |
|-------|--------|
| Backend | Node.js + Express 4, entry point `backend/server.js`, listens on `PORT` (default **3000**) |
| Data layer | **MySQL** via **Prisma** (`@prisma/client` 6.x). Schema at `backend/prisma/schema.prisma`. **No `prisma/migrations/` folder exists** → schema is applied with `prisma db push` |
| Frontend | Static vanilla HTML/CSS/JS in `frontend/` (no build step). Served by Express from `../frontend` with an SPA fallback to `frontend/index.html` |
| Uploads | Disk storage under `backend/uploads/{products,banners,homepage-categories,payment-proofs}` via Multer (5 MB/file, images only) |
| Auth | JWT (`jsonwebtoken`), bcrypt password hashing. Admin role flag on the `users` table |
| API base | `/api` (e.g. `/api/products`). Health check: `GET /api/health` |

> **Note on repo structure:** The backend is its own npm package (`backend/package.json`) with all runtime dependencies. The root `package.json` only carries Playwright for tests and is **not** needed in production.

---

## ⚠️ Deployment risks found in this project — read first

These were found during code inspection. Address each one before or during deployment.

1. **Default admin credentials.** `backend/config/seed.mysql.js` seeds `admin@domdom.com` / `password123`. **Change this password immediately after first login** (or before seeding in prod). Anyone who reads this repo knows the default.
2. **Weak DB password committed to dev `.env`.** The dev `backend/.env` uses `mysql://domdom:domdom_pw_2026@...`. **Generate a fresh, strong MySQL password for production** — do not reuse this.
3. **CORS reflects any origin when `CORS_ORIGIN` is empty.** In `server.js`, an empty `CORS_ORIGIN` falls back to `origin: true` (reflect any origin). **You must set `CORS_ORIGIN` to your real domain(s) in production.**
4. **Payment proofs contain customer PII.** `backend/uploads/payment-proofs/` holds uploaded InstaPay/Vodafone Cash screenshots (names, phone numbers, transaction refs). These are served as static files under `/uploads/...` with **no auth**. Treat this directory as sensitive: back it up encrypted, restrict OS permissions, and consider moving proof serving behind an authenticated route later.
5. **No Prisma migration history.** There is no `prisma/migrations/` directory, so production schema is created with `prisma db push` (state-based, no rollback history). Fine for the first deploy; for ongoing changes consider adopting `prisma migrate` to get versioned migrations.
6. **`prisma generate` is not in a `postinstall` hook.** `npm ci` alone will **not** generate the Prisma client. You must run `npx prisma generate` explicitly (covered below).
7. **CSP uses `'unsafe-inline'` for scripts.** `helmet` is configured but the pages rely on inline `onclick=` handlers, so the script CSP is permissive. This is a known, deferred item — not a deploy blocker, but don't treat the CSP as full XSS protection.
8. **Body size limits.** Express accepts JSON up to `10mb` and Multer accepts 5 MB image uploads. Nginx's default `client_max_body_size` (1 MB) will reject uploads — you **must** raise it (covered in the Nginx section).
9. **Uploads are not in version control.** `backend/uploads/` is git-ignored. A fresh `git clone` will not contain existing images — migrate the uploads directory separately and ensure it persists across deploys.

---

## 1. Pre-deployment checklist

### 1.1 Required environment variables (`backend/.env`)

From `server.js` and `.env.example`:

| Variable | Required | Purpose / production value |
|----------|----------|----------------------------|
| `JWT_SECRET` | ✅ Yes | Signs JWTs. Server **exits** if missing; warns if `< 32` chars. Use 96 hex chars. |
| `DATABASE_URL` | ✅ Yes | MySQL connection string for Prisma. Server **exits** if missing. |
| `PORT` | No (default 3000) | Express listen port. Keep 3000; Nginx proxies to it. |
| `CORS_ORIGIN` | **Strongly recommended** | Comma-separated allowed origins. **Empty = reflect any origin (insecure).** Set to your domain. |
| `TRUST_PROXY` | **Yes (behind Nginx)** | Set to `1` so rate limiting & logging see the real client IP. |

Generate a production `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Example **production** `backend/.env`:

```dotenv
PORT=3000
JWT_SECRET=<paste the 96-hex output from the command above>
DATABASE_URL="mysql://domdom:<STRONG_DB_PASSWORD>@localhost:3306/domdom"
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
TRUST_PROXY=1
```

### 1.2 Production configuration checks

- [ ] `JWT_SECRET` is a fresh 96-hex value, **not** the dev one (rotating it logs out all existing sessions — expected).
- [ ] `DATABASE_URL` uses a strong, unique MySQL password.
- [ ] `CORS_ORIGIN` is set to the real domain(s).
- [ ] `TRUST_PROXY=1`.
- [ ] `NODE_ENV=production` is set in the PM2 ecosystem file (section 4).

### 1.3 Security checks

- [ ] Plan to change the seeded admin password after first login.
- [ ] `.env` files are git-ignored (confirmed in root `.gitignore`).
- [ ] No secrets are committed. Verify locally before pushing:
  ```bash
  git grep -nE "JWT_SECRET|DATABASE_URL|password123" -- ':!*.example' ':!DEPLOYMENT_GUIDE.md'
  ```

### 1.4 Database preparation

- MySQL 8.x server reachable at `localhost:3306`.
- A database `domdom` and a dedicated user with privileges on it (section 3.5).

### 1.5 Build & validation steps (run locally before deploying)

There is **no frontend build** (static files). Backend validation:

```bash
cd backend
npm ci
npx prisma generate          # generates the Prisma client (NOT automatic)
npx prisma validate          # validates schema.prisma
node -e "require('./server.js')" # smoke check (Ctrl-C after it prints the banner)
```

---

## 2. VPS setup (initial server hardening)

SSH in as root (Hostinger gives you root + the VPS IP):

```bash
ssh root@<VPS_IP>
```

### 2.1 Update the system

```bash
apt update && apt upgrade -y
timedatectl set-timezone Africa/Cairo   # adjust as needed
```

### 2.2 Create a non-root deploy user

```bash
adduser domdom
usermod -aG sudo domdom

# Copy your SSH key so you can log in as the new user
rsync --archive --chown=domdom:domdom ~/.ssh /home/domdom
```

### 2.3 Harden SSH

Edit `/etc/ssh/sshd_config`:

```bash
nano /etc/ssh/sshd_config
```

Set:

```
PermitRootLogin no
PasswordAuthentication no
```

Then:

```bash
systemctl restart ssh
```

Open a **new** terminal and confirm `ssh domdom@<VPS_IP>` works before closing the root session.

### 2.4 Firewall (UFW)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'    # opens 80 + 443
ufw enable
ufw status verbose
```

> Do **not** open port 3000 — Node stays bound to localhost behind Nginx.

### 2.5 Install required packages

```bash
# Node.js 20 LTS (matches Prisma 6 / Express 4 requirements)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# MySQL, Nginx, Git, build tools, certbot
sudo apt install -y mysql-server nginx git build-essential

# PM2 globally
sudo npm install -g pm2

# Verify
node -v && npm -v && nginx -v && mysql --version && pm2 -v
```

---

## 3. Application deployment

Work as the **`domdom`** user. App will live at **`/home/domdom/app`**.

### 3.1 Git setup

This project is **not yet a git repository**. Choose one path:

**Option A — push to a remote, clone on the server (recommended).** Locally:

```bash
cd C:\Users\Basse\domdom
git init
git add .
git commit -m "Initial commit for deployment"
git remote add origin git@github.com:<you>/domdom.git
git push -u origin main
```

On the server:

```bash
cd ~
git clone https://github.com/<you>/domdom.git app
```

**Option B — no remote, upload directly** (from your Windows machine, using PowerShell + scp/rsync):

```powershell
scp -r C:\Users\Basse\domdom\backend  domdom@<VPS_IP>:/home/domdom/app/backend
scp -r C:\Users\Basse\domdom\frontend domdom@<VPS_IP>:/home/domdom/app/frontend
```

> Either way, **do not upload `node_modules`** (rebuilt on the server) and remember **`backend/uploads/` and `.env` are git-ignored** — transfer those separately (sections 3.4 and 9).

### 3.2 Install dependencies

```bash
cd /home/domdom/app/backend
npm ci --omit=dev      # installs runtime deps only
# Prisma CLI is a devDependency — install it just for generate/push, or use npx with --no-install fallback:
npm install prisma@^6.19.3 --no-save   # CLI needed for generate & db push
npx prisma generate
```

> `npm ci --omit=dev` skips `prisma` (the CLI) and `nodemon`. Prisma's CLI is required once for `generate` and `db push`. Installing it `--no-save` keeps `package.json` clean. The `@prisma/client` runtime dependency **is** installed by the line above.

### 3.3 Environment configuration

```bash
cd /home/domdom/app/backend
cp .env.example .env
nano .env        # fill in the production values from section 1.1
chmod 600 .env   # owner read/write only
```

### 3.4 Uploads directory

`backend/uploads/` is not in git. Create it (and its subfolders) and/or restore from backup:

```bash
mkdir -p /home/domdom/app/backend/uploads/{products,banners,homepage-categories,payment-proofs}
chmod 750 /home/domdom/app/backend/uploads
# payment-proofs hold customer PII — keep them owner/group only:
chmod 750 /home/domdom/app/backend/uploads/payment-proofs
```

To migrate existing images from your dev machine:

```powershell
scp -r C:\Users\Basse\domdom\backend\uploads\* domdom@<VPS_IP>:/home/domdom/app/backend/uploads/
```

### 3.5 Database configuration

Secure MySQL and create the DB + user:

```bash
sudo mysql_secure_installation   # set root password, remove anon users/test db
```

```bash
sudo mysql
```

```sql
CREATE DATABASE domdom CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'domdom'@'localhost' IDENTIFIED BY '<STRONG_DB_PASSWORD>';
GRANT ALL PRIVILEGES ON domdom.* TO 'domdom'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Make sure `DATABASE_URL` in `.env` matches this user/password/db.

### 3.6 Apply the schema & seed

There are **no migration files**, so apply the schema directly with `db push`:

```bash
cd /home/domdom/app/backend
npx prisma db push          # creates all tables from schema.prisma
node config/seed.mysql.js   # creates admin + sample products + homepage categories
```

`seed.mysql.js` is idempotent (skips if data already exists). It prints the admin credentials — **log in and change the password immediately**.

---

## 4. PM2 configuration

### 4.1 Ecosystem file

Create `/home/domdom/app/backend/ecosystem.config.js`:

```js
module.exports = {
  apps: [{
    name: 'domdom-api',
    script: 'server.js',
    cwd: '/home/domdom/app/backend',
    instances: 1,                 // single instance: Multer writes to local disk & uses in-memory rate-limit store
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '400M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/home/domdom/.pm2/logs/domdom-api-error.log',
    out_file:   '/home/domdom/.pm2/logs/domdom-api-out.log',
    time: true                    // timestamp log lines
  }]
};
```

> **Why a single instance / fork mode:** uploads are written to the local filesystem and `express-rate-limit` uses an in-memory store. Running `cluster` mode with multiple instances would split rate-limit counters and is unnecessary for this workload. Scale vertically first; if you later need multiple instances, move rate-limit state to Redis and uploads to shared storage.

### 4.2 Start, save, and enable on reboot

```bash
cd /home/domdom/app/backend
pm2 start ecosystem.config.js
pm2 save                         # persist the process list
pm2 startup systemd              # prints a command — copy/paste & run it (with sudo)
```

### 4.3 Auto-restart & log management

PM2 auto-restarts on crash and on the `max_memory_restart` threshold. Add log rotation:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

Useful commands:

```bash
pm2 status
pm2 logs domdom-api
pm2 restart domdom-api
pm2 reload domdom-api      # zero-downtime-ish restart
```

---

## 5. Nginx configuration

**Recommended architecture:** Nginx serves the static frontend and `/uploads` directly (fast, cacheable) and reverse-proxies only `/api` to Node. This is more efficient than letting Express serve static assets.

Create `/etc/nginx/sites-available/domdom`:

```nginx
# Cache static assets aggressively; HTML not at all (SPA shell must stay fresh)
map $sent_http_content_type $cache_control {
    default                   "no-cache";
    ~image/                   "public, max-age=2592000, immutable";
    ~font/                    "public, max-age=2592000, immutable";
    text/css                  "public, max-age=604800";
    application/javascript    "public, max-age=604800";
}

server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Allow image uploads (Express accepts 10mb JSON / 5mb files; default Nginx limit is 1mb)
    client_max_body_size 12m;

    root /home/domdom/app/frontend;
    index index.html;

    # gzip
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # --- API → Node (Express on :3000) ---
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # --- Uploaded images → Node (Multer writes under backend/uploads) ---
    # Served via Node so paths match the app; cache at the edge.
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }

    # --- Static frontend assets ---
    location ~* \.(css|js|jpg|jpeg|png|gif|svg|ico|webp|woff2?)$ {
        try_files $uri =404;
        add_header Cache-Control $cache_control;
    }

    # --- SPA fallback: serve index.html for any non-file route ---
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

> The app's own SPA fallback in `server.js` still works if you proxy everything to Node instead — but serving static files directly from Nginx (above) is the production-recommended setup. If you prefer the simplest config, replace all `location` blocks with a single `location / { proxy_pass http://127.0.0.1:3000; ... }` and let Express serve frontend + uploads.

Enable it and reload:

```bash
sudo ln -s /etc/nginx/sites-available/domdom /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t          # test config
sudo systemctl reload nginx
```

### Caching recommendations

- HTML (`index.html` / SPA shell): **no-cache** so deploys are picked up immediately.
- Hashed-less JS/CSS in this project: `max-age=604800` (1 week) is a safe balance since filenames aren't content-hashed. After a deploy that changes CSS/JS, either bump a `?v=` query string in the HTML or shorten this window.
- Images/uploads: 30 days.

---

## 6. SSL setup (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot edits the Nginx config to add the `443` server block and an HTTP→HTTPS redirect. Verify auto-renewal:

```bash
sudo certbot renew --dry-run
systemctl list-timers | grep certbot     # confirm the renewal timer is active
```

After HTTPS is live, double-check `CORS_ORIGIN` in `.env` uses `https://` and `pm2 restart domdom-api`.

---

## 7. Security hardening

| Area | Status in code | Action |
|------|----------------|--------|
| **Helmet** | ✅ Enabled in `server.js` with a custom CSP (script `'unsafe-inline'` allowed) | Keep. Long-term: refactor inline `onclick` handlers so CSP can drop `'unsafe-inline'`. |
| **CORS** | ⚠️ Reflects any origin if `CORS_ORIGIN` unset | **Set `CORS_ORIGIN`** to your domain(s). |
| **Rate limiting** | ✅ `authLimiter` (10/15 min) on login/register; `publicWriteLimiter` (60/15 min) on coupon-validate & newsletter | Requires `TRUST_PROXY=1` to rate-limit by real IP behind Nginx. |
| **Secret management** | `.env` only; server fails fast if `JWT_SECRET`/`DATABASE_URL` missing | `chmod 600 backend/.env`; never commit it; rotate `JWT_SECRET` for prod. |
| **File permissions** | — | See below. |
| **MySQL** | — | `mysql_secure_installation`; user limited to the `domdom` DB; bind to localhost only. |
| **Payment-proof PII** | ⚠️ Served unauthenticated under `/uploads/payment-proofs` | Restrict OS perms; back up encrypted; plan to move behind auth. |

### File permissions

```bash
# App owned by the deploy user, group-readable
sudo chown -R domdom:domdom /home/domdom/app
chmod 600 /home/domdom/app/backend/.env
chmod -R 755 /home/domdom/app/frontend
chmod 750 /home/domdom/app/backend/uploads/payment-proofs
```

### MySQL: confirm it only listens locally

```bash
sudo ss -tlnp | grep 3306     # should show 127.0.0.1:3306, not 0.0.0.0
```

If needed, set `bind-address = 127.0.0.1` in `/etc/mysql/mysql.conf.d/mysqld.cnf` and `sudo systemctl restart mysql`.

---

## 8. Monitoring

### PM2 monitoring

```bash
pm2 status              # process state, restarts, memory
pm2 monit               # live CPU/memory dashboard
pm2 describe domdom-api # full process details
```

### Log locations

| Source | Path |
|--------|------|
| App stdout | `/home/domdom/.pm2/logs/domdom-api-out.log` |
| App errors | `/home/domdom/.pm2/logs/domdom-api-error.log` |
| Nginx access | `/var/log/nginx/access.log` |
| Nginx errors | `/var/log/nginx/error.log` |
| MySQL errors | `/var/log/mysql/error.log` |

```bash
pm2 logs domdom-api --lines 100
sudo tail -f /var/log/nginx/error.log
```

### Health check

```bash
curl -i http://127.0.0.1:3000/api/health     # local, behind proxy
curl -i https://yourdomain.com/api/health     # public
```

> The app uses `console.error` for errors (no structured logger yet). For deeper observability, adding `pino`/`morgan` is a recommended follow-up.

---

## 9. Backup strategy

### 9.1 Automated MySQL backups

Create `/home/domdom/backup-db.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR=/home/domdom/backups/db
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%F_%H%M)
# Reads DATABASE_URL creds; adjust user/pass if you prefer a ~/.my.cnf
mysqldump -u domdom -p'<STRONG_DB_PASSWORD>' --single-transaction --routines domdom \
  | gzip > "$BACKUP_DIR/domdom_$STAMP.sql.gz"
# keep 14 days
find "$BACKUP_DIR" -name 'domdom_*.sql.gz' -mtime +14 -delete
```

```bash
chmod 700 /home/domdom/backup-db.sh
crontab -e
# add: nightly at 02:30
30 2 * * * /home/domdom/backup-db.sh >> /home/domdom/backups/db-backup.log 2>&1
```

### 9.2 File (uploads) backups

`backend/uploads/` is **not** in git and includes customer payment proofs — back it up separately:

```bash
# add to a daily cron
0 3 * * * tar -czf /home/domdom/backups/uploads_$(date +\%F).tar.gz -C /home/domdom/app/backend uploads && find /home/domdom/backups -name 'uploads_*.tar.gz' -mtime +14 -delete
```

Store copies **off-server** (e.g. `rsync`/`scp` to another host or object storage). Encrypt the payment-proof backups.

### 9.3 Restore procedures

**Database:**

```bash
gunzip < /home/domdom/backups/db/domdom_<STAMP>.sql.gz | mysql -u domdom -p domdom
```

**Uploads:**

```bash
tar -xzf /home/domdom/backups/uploads_<DATE>.tar.gz -C /home/domdom/app/backend
```

**Full schema rebuild from scratch** (disaster recovery, empty DB):

```bash
cd /home/domdom/app/backend
npx prisma db push
# then restore data from the SQL dump above
```

---

## 10. Deployment verification checklist

### Frontend
- [ ] `https://yourdomain.com/` loads the homepage (`frontend/index.html`).
- [ ] CSS/JS load (no 404s in browser devtools Network tab).
- [ ] Product images under `/uploads/products/...` render.
- [ ] Deep links work (e.g. `https://yourdomain.com/pages/shop.html`) and SPA fallback returns `index.html` for unknown routes.

### API
- [ ] `curl https://yourdomain.com/api/health` → `{"status":"ok",...}`.
- [ ] `curl https://yourdomain.com/api/products` returns seeded products.
- [ ] Admin login at `/pages/admin.html` works (then **change the admin password**).
- [ ] An image upload via the admin panel succeeds (verifies Nginx `client_max_body_size` and Multer).
- [ ] Placing a test order + uploading a payment proof works.

### Database
- [ ] `mysql -u domdom -p -e "USE domdom; SHOW TABLES;"` lists all tables (`users`, `products`, `orders`, …).
- [ ] `SELECT COUNT(*) FROM products;` returns the seeded rows.

### SSL
- [ ] `https://` padlock is valid; `http://` redirects to `https://`.
- [ ] `sudo certbot renew --dry-run` succeeds.

### Performance
- [ ] Static assets return `Cache-Control` headers (check devtools).
- [ ] `gzip` is active (`Content-Encoding: gzip` on CSS/JS).
- [ ] `pm2 status` shows the app `online` with low restart count.

---

## 11. Troubleshooting

### PM2
- **App keeps restarting / `errored`:** `pm2 logs domdom-api --err`. Most common cause here is a missing/invalid env var — `server.js` calls `process.exit(1)` if `JWT_SECRET` or `DATABASE_URL` is absent. Verify `.env` and that PM2's `cwd` is `/home/domdom/app/backend`.
- **Changes not picked up:** `pm2 reload domdom-api`. After editing `.env`, a restart is required (`pm2 restart domdom-api`).
- **Not starting on reboot:** re-run the `pm2 startup` command and `pm2 save`.

### Nginx
- **502 Bad Gateway:** Node isn't running or isn't on `:3000`. Check `pm2 status` and `curl http://127.0.0.1:3000/api/health`.
- **413 Request Entity Too Large** on image upload: raise `client_max_body_size` (set to `12m` above) and `sudo systemctl reload nginx`.
- **404 on `/uploads/...`:** confirm the proxy/`root` path and that the file exists under `backend/uploads/`.
- **Config errors:** `sudo nginx -t` before every reload.

### MySQL / Prisma
- **`P1001: Can't reach database server`:** MySQL down or wrong `DATABASE_URL`. `sudo systemctl status mysql`; verify host/port/creds.
- **`P1000: Authentication failed`:** wrong user/password in `DATABASE_URL`, or the `domdom` user lacks privileges — re-check section 3.5.
- **Tables missing:** run `npx prisma db push` (no migration files exist in this project).
- **`@prisma/client did not initialize yet` / client errors:** run `npx prisma generate` (it is **not** automatic on install), then `pm2 restart domdom-api`.

### Node.js
- **`Missing required environment variables`:** `.env` not loaded — confirm the file is at `backend/.env` and PM2 `cwd` is the backend dir.
- **`JWT_SECRET is shorter than 32 characters` warning:** regenerate a longer secret (section 1.1).
- **CORS errors in the browser:** `CORS_ORIGIN` doesn't include the exact scheme+host the browser uses. Include both apex and `www` with `https://`.
- **Rate-limit blocking legitimate users / wrong IPs in logs:** ensure `TRUST_PROXY=1` so Express reads `X-Forwarded-For` from Nginx.

---

## Appendix — Redeploy (updating an existing deployment)

```bash
cd /home/domdom/app
git pull origin main                 # or re-upload changed files
cd backend
npm ci --omit=dev
npx prisma generate                  # if schema or @prisma/client changed
npx prisma db push                   # if schema.prisma changed
pm2 reload domdom-api
```

Frontend-only changes need no restart (Nginx serves them); consider bumping `?v=` query strings on JS/CSS to bust caches.
