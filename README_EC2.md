# Raccoon Cleaning Calendar – Deploy on Ubuntu EC2 (no Docker)

Step-by-step deployment on a **Ubuntu** EC2 instance using Node.js LTS, PostgreSQL, Nginx, and systemd (or pm2).

## Prerequisites

- Ubuntu 22.04 LTS (or similar) on EC2
- SSH access
- Domain pointing to the instance (optional; needed for HTTPS with certbot)

---

## 1. Install Node.js LTS and pnpm

```bash
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pnpm
node -v   # e.g. v20.x or v22.x
pnpm -v   # e.g. 9.x
```

---

## 2. Install and set up PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

Create database and user:

```bash
sudo -u postgres psql
```

In the PostgreSQL shell:

```sql
CREATE USER rccalendar_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE rccalendar OWNER rccalendar_user;
\q
```

(Optional) Allow local connections in `pg_hba.conf` if your app and DB are on the same host; default “local” and “127.0.0.1” are usually enough.

---

## 3. Deploy the app

Clone (or upload) the repo, e.g. under `/var/www` or your preferred path:

```bash
sudo mkdir -p /var/www
sudo chown "$USER" /var/www
cd /var/www
git clone <your-repo-url> rccalendar
cd rccalendar
```

Install dependencies and build:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
```

---

## 4. Environment variables

Create and edit `.env` for the API:

```bash
cp apps/api/.env.example apps/api/.env
nano apps/api/.env
```

Set at least:

```env
DATABASE_URL="postgresql://rccalendar_user:your_secure_password@localhost:5432/rccalendar?schema=public"
JWT_SECRET="your-long-random-secret"
PORT=4000
CORS_ORIGIN="https://yourdomain.com"
```

Replace `yourdomain.com` with your real domain or, for testing, `http://<EC2-public-ip>` (and use `http` if you have no HTTPS yet).

Run migrations and seed:

```bash
pnpm db:migrate:deploy
pnpm db:seed
```

---

## 5. Run backend and frontend as services (systemd)

Create two systemd units so the API and Next.js run on boot and restart on failure.

**API service** (`/etc/systemd/system/rccalendar-api.service`):

```ini
[Unit]
Description=RCCalendar NestJS API
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/rccalendar
Environment=NODE_ENV=production
EnvironmentFile=/var/www/rccalendar/apps/api/.env
ExecStart=/usr/bin/node apps/api/dist/main.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Adjust `User` and `WorkingDirectory` if you use another user or path.

**Web service** (`/etc/systemd/system/rccalendar-web.service`):

```ini
[Unit]
Description=RCCalendar Next.js
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/rccalendar/apps/web/.next/standalone
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

After `pnpm build`, copy static assets from repo root:

```bash
cp -r apps/web/.next/static apps/web/.next/standalone/.next/
cp -r apps/web/public apps/web/.next/standalone/ 2>/dev/null || true
```

Alternative (no standalone): use WorkingDirectory=/var/www/rccalendar and ExecStart=/usr/bin/pnpm run start --filter web.

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable rccalendar-api rccalendar-web
sudo systemctl start rccalendar-api rccalendar-web
sudo systemctl status rccalendar-api rccalendar-web
```

---

## 6. Alternative: run with pm2

If you prefer pm2 instead of systemd:

```bash
sudo npm install -g pm2
cd /var/www/rccalendar
pnpm build
```

Create `ecosystem.config.cjs` in the repo root:

```js
module.exports = {
  apps: [
    {
      name: 'rccalendar-api',
      cwd: '/var/www/rccalendar',
      script: 'node',
      args: 'apps/api/dist/main.js',
      env: { NODE_ENV: 'production' },
      env_file: '/var/www/rccalendar/apps/api/.env',
    },
    {
      name: 'rccalendar-web',
      cwd: '/var/www/rccalendar/apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      env: { NODE_ENV: 'production', PORT: 3000 },
    },
  ],
};
```

Start and enable on boot:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## 7. Nginx reverse proxy

Install Nginx:

```bash
sudo apt install -y nginx
```

Create a site config, e.g. `/etc/nginx/sites-available/rccalendar`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    # Or use default_server and/or your EC2 public IP for testing

    location /api {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/rccalendar /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

- `/api` → backend on port 4000  
- `/` → frontend on port 3000  

Ensure `CORS_ORIGIN` and any “API base URL” in the frontend match the public URL (e.g. `https://yourdomain.com` or `http://<EC2-IP>`).

---

## 8. Optional: HTTPS with Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Follow the prompts. Certbot will adjust your Nginx config for HTTPS. Renewal is automatic.

After TLS is in place, set `CORS_ORIGIN="https://yourdomain.com"` and use HTTPS in the app.

---

## Quick reference

| Component    | Port | Systemd service     |
|-------------|------|---------------------|
| API (NestJS)| 4000 | rccalendar-api      |
| Web (Next.js)| 3000 | rccalendar-web      |
| Nginx       | 80/443 | nginx             |

- **API base URL for browser:** `https://yourdomain.com/api` (or `http://<EC2-IP>/api`).
- **Frontend:** `https://yourdomain.com/` (or `http://<EC2-IP>/`).

Log in with the seeded user (`admin` / `admin123`) and create more users from **Settings → Users**.
