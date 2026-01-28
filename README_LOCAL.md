# Raccoon Cleaning Calendar – Run Locally

## Prerequisites

- **Node.js** LTS (v20+)
- **pnpm** 9+
- **PostgreSQL** 14+ (running locally)

## 1. Clone and install

```bash
cd RCCalendar
pnpm install
```

Installs are deterministic: commit `pnpm-lock.yaml` and run `pnpm install` (or `pnpm install --frozen-lockfile` in CI). The API pins `streamsearch` so the multer/busboy chain resolves in the monorepo.

### If Prisma, Next.js, or install is broken (e.g. MODULE_NOT_FOUND / “prisma not found” / Next dev fails)

Run a clean reinstall from the repo root (PowerShell):

```powershell
.\scripts\clean-prisma.ps1
```

This removes `node_modules`, `apps/web/.next`, `apps/api/dist`, prunes the pnpm store, and runs `pnpm install`. Optional: use `-KillNode` to stop node processes using the repo first:

```powershell
.\scripts\clean-prisma.ps1 -KillNode
```

Or manually:

```bash
# From repo root
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force apps\web\.next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force apps\api\dist -ErrorAction SilentlyContinue
pnpm store prune
pnpm install
```

Then run:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## 2. PostgreSQL

Create a database and user (e.g. via `psql` or pgAdmin):

```sql
CREATE USER rccalendar_user WITH PASSWORD 'your_password';
CREATE DATABASE rccalendar OWNER rccalendar_user;
```

## 3. Environment variables

Copy the example env and set your DB URL:

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

- `DATABASE_URL="postgresql://rccalendar_user:your_password@localhost:5432/rccalendar?schema=public"`
- Leave or change `JWT_SECRET`, `PORT`, `CORS_ORIGIN` as needed.

## 4. Database migrations and seed

Prisma uses `DATABASE_URL` from `apps/api/.env` when you run from the repo root (db scripts run in the api workspace).

From the repo root:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Or from `apps/api`:

```bash
cd apps/api
pnpm run prisma:generate
pnpm run prisma:migrate
pnpm run prisma:seed
```

## 5. Run API and web

From the repo root:

```bash
# Terminal 1 – backend
pnpm dev:api

# Terminal 2 – frontend (Linux/Mac)
pnpm dev:web

# Terminal 2 – frontend (Windows, if you see EACCES on 0.0.0.0)
pnpm --filter web dev:win
```

- **API:** http://127.0.0.1:3101 (default; set `HOST` and `PORT` in `apps/api/.env` to override)  
- **Web:** http://localhost:3000 (default) or http://127.0.0.1:3100 (Windows `dev:win`)  

The Next.js dev server rewrites `/api/*` to the backend (http://127.0.0.1:3101 by default, configurable via `API_ORIGIN` env var), so the app talks to the API via the same origin.

**Windows note:** If you see `listen EACCES permission denied 0.0.0.0:3000` or similar, Windows is blocking binding to all interfaces (0.0.0.0). Use `pnpm --filter web dev:win` for the frontend (binds to 127.0.0.1:3100). The API defaults to 127.0.0.1:3101 to avoid this issue.

## 6. First login

After seeding you can log in with:

- **Username:** `admin`  
- **Password:** `admin123`  

Create more users from **Settings → Users** (any logged-in user can do this).

## Scripts reference

| Command | Description |
|--------|-------------|
| `pnpm dev` | Run api + web in parallel |
| `pnpm dev:api` | Run NestJS API (watch, binds to 127.0.0.1:3101) |
| `pnpm dev:web` | Run Next.js (default port, no hardcoded host) |
| `pnpm --filter web dev:win` | Run Next.js on Windows (127.0.0.1:3100, avoids EACCES) |
| `pnpm build` | Build api and web |
| `pnpm db:generate` | Prisma generate (api) |
| `pnpm db:migrate` | Prisma migrate dev (api) |
| `pnpm db:migrate:deploy` | Prisma migrate deploy (production) |
| `pnpm db:seed` | Run seed (api) |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm smoke:api` | Check that API runtime deps (@nestjs/platform-express, multer, busboy, streamsearch) load; use if API won’t start |

## Troubleshooting

- **“Database does not exist”** – Create the DB and user (step 2) and check `DATABASE_URL`.
- **“Port 3101 in use” or “EACCES on 0.0.0.0:3000/3100/3101”** – Default API port is 3101, binds to 127.0.0.1 (localhost-only) to avoid Windows EACCES. Set `HOST` and `PORT` in `apps/api/.env` to override. For Next.js on Windows, use `pnpm --filter web dev:win` (binds to 127.0.0.1:3100).
- **CORS / 401 on login** – Ensure `CORS_ORIGIN` in `.env` matches the frontend origin (e.g. `http://localhost:3000`).
- **Prisma “schema not in sync”** – Run `pnpm db:migrate` from the repo root (or `pnpm run prisma:migrate` in `apps/api`).
- **MODULE_NOT_FOUND / “prisma not found”** – Run `.\scripts\clean-prisma.ps1` from the repo root, then `pnpm db:generate`.
- **Next.js dev fails (e.g. “Cannot find module” / requireStack)** – Web uses Next 15 + React 18.2. Pin versions in `apps/web/package.json`, then clean reinstall: remove `node_modules` and `apps/web/.next`, run `pnpm store prune`, then `pnpm install`. See “If Prisma, Next.js, or install is broken” above.
- **API “No driver (HTTP) has been selected”** – Ensure `@nestjs/platform-express` is installed: from repo root run `pnpm install`, or from `apps/api` run `pnpm add @nestjs/platform-express`. The API uses `new ExpressAdapter()` in `main.ts` to select the Express driver; if the package is missing, add it and run a clean install.
- **API “Cannot find module 'streamsearch'” (or busboy/multer)** – The API declares `streamsearch` in `apps/api/package.json` so the multer/busboy chain resolves. Run `pnpm smoke:api` from the repo root; if it fails, run `pnpm install` and try again. If the API still won’t start, run a clean reinstall (see “If Prisma, Next.js, or install is broken” above), then `pnpm smoke:api` and `pnpm dev:api`.
