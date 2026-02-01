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

# Terminal 2 – frontend
pnpm dev:web
```

- **API:** Uses `PORT` and `HOST` from `apps/api/.env` (e.g. http://127.0.0.1:55556 if `PORT=55556`).  
- **Web:** http://127.0.0.1:5173 (dev script binds to 127.0.0.1 to avoid Windows EACCES).

The Next.js dev server rewrites `/api/*` to the backend. Default `API_ORIGIN` in `apps/web/next.config.ts` is `http://127.0.0.1:55556`; it must match the API `PORT` in `apps/api/.env`. **ECONNREFUSED 127.0.0.1:55556** means the API is not running—start the API first (Terminal 1), then the web app (Terminal 2).

## 6. First login

After seeding you can log in with:

- **Username:** `admin`  
- **Password:** `admin123`  

Create more users from **Settings → Users** (any logged-in user can do this).

## Verification (Windows PowerShell)

Run these in order to avoid ECONNREFUSED and stale .next:

```powershell
# From repo root
cd C:\Users\<you>\Documents\RCCalendar

# 1. Clean web build cache (fixes "Cannot find module './561.js'" etc.)
pnpm clean:web

# 2. Install (API postinstall runs prisma generate)
pnpm install

# 3. Ensure Prisma client is generated (if postinstall was skipped)
pnpm db:generate

# 4. Terminal 1 – start API (must listen on PORT from apps/api/.env, e.g. 55556)
pnpm dev:api

# 5. Terminal 2 – start web (opens http://127.0.0.1:5173)
pnpm dev:web
```

Do not start web before the API is listening; otherwise you will see ECONNREFUSED when the app calls `/api/*`.

## Scripts reference

| Command | Description |
|--------|-------------|
| `pnpm dev` | Run api + web in parallel |
| `pnpm dev:api` | Run NestJS API (watch; PORT from apps/api/.env) |
| `pnpm dev:web` | Run Next.js (127.0.0.1:5173) |
| `pnpm clean:web` | Remove apps/web/.next (fix corrupted cache) |
| `pnpm build` | Build api and web |
| `pnpm db:generate` | Prisma generate (api; also runs in api postinstall) |
| `pnpm db:migrate` | Prisma migrate dev (api) |
| `pnpm db:migrate:deploy` | Prisma migrate deploy (production) |
| `pnpm db:seed` | Run seed (api) |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm smoke:api` | Check that API runtime deps load; use if API won’t start |

## Troubleshooting

- **“Database does not exist”** – Create the DB and user (step 2) and check `DATABASE_URL`.
- **ECONNREFUSED 127.0.0.1:55556** – The web app proxies `/api/*` to the API at the URL in `API_ORIGIN` (default 127.0.0.1:55556). Start the API first (`pnpm dev:api`); ensure `PORT` in `apps/api/.env` matches (e.g. 55556).
- **“Port in use” or “EACCES on 0.0.0.0”** – Set `HOST` and `PORT` in `apps/api/.env`. Web dev binds to 127.0.0.1:5173 to avoid EACCES.
- **“Cannot find module './561.js'” or similar in .next** – Corrupted Next.js cache. Run `pnpm clean:web`, then `pnpm dev:web`.
- **CORS / 401 on login** – Ensure `CORS_ORIGIN` in `apps/api/.env` matches the frontend origin (e.g. `http://127.0.0.1:5173`).
- **Prisma “schema not in sync”** – Run `pnpm db:migrate` from the repo root (or `pnpm run prisma:migrate` in `apps/api`).
- **MODULE_NOT_FOUND / “prisma not found”** – Run `.\scripts\clean-prisma.ps1` from the repo root, then `pnpm db:generate`.
- **Next.js dev fails (e.g. “Cannot find module” / requireStack)** – Web uses Next 15 + React 18.2. Pin versions in `apps/web/package.json`, then clean reinstall: remove `node_modules` and `apps/web/.next`, run `pnpm store prune`, then `pnpm install`. See “If Prisma, Next.js, or install is broken” above.
- **API “No driver (HTTP) has been selected”** – Ensure `@nestjs/platform-express` is installed: from repo root run `pnpm install`, or from `apps/api` run `pnpm add @nestjs/platform-express`. The API uses `new ExpressAdapter()` in `main.ts` to select the Express driver; if the package is missing, add it and run a clean install.
- **API “Cannot find module 'streamsearch'” (or busboy/multer)** – The API declares `streamsearch` in `apps/api/package.json` so the multer/busboy chain resolves. Run `pnpm smoke:api` from the repo root; if it fails, run `pnpm install` and try again. If the API still won’t start, run a clean reinstall (see “If Prisma, Next.js, or install is broken” above), then `pnpm smoke:api` and `pnpm dev:api`.
