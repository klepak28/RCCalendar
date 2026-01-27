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

### If Prisma or install is broken (e.g. MODULE_NOT_FOUND / “prisma not found”)

Run a clean reinstall from the repo root (PowerShell):

```powershell
.\scripts\clean-prisma.ps1
```

This removes `node_modules`, `apps/web/.next`, `apps/api/dist`, prunes the pnpm store, and runs `pnpm install`. Optional: use `-KillNode` to stop node processes using the repo first:

```powershell
.\scripts\clean-prisma.ps1 -KillNode
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

- **API:** http://localhost:4000  
- **Web:** http://localhost:3000  

The Next.js dev server rewrites `/api/*` to the backend, so the app at http://localhost:3000 talks to the API via the same origin.

## 6. First login

After seeding you can log in with:

- **Username:** `admin`  
- **Password:** `admin123`  

Create more users from **Settings → Users** (any logged-in user can do this).

## Scripts reference

| Command | Description |
|--------|-------------|
| `pnpm dev` | Run api + web in parallel |
| `pnpm dev:api` | Run NestJS API (watch) |
| `pnpm dev:web` | Run Next.js (port 3000) |
| `pnpm build` | Build api and web |
| `pnpm db:generate` | Prisma generate (api) |
| `pnpm db:migrate` | Prisma migrate dev (api) |
| `pnpm db:migrate:deploy` | Prisma migrate deploy (production) |
| `pnpm db:seed` | Run seed (api) |
| `pnpm db:studio` | Open Prisma Studio |

## Troubleshooting

- **“Database does not exist”** – Create the DB and user (step 2) and check `DATABASE_URL`.
- **“Port 4000 in use”** – Set `PORT` in `apps/api/.env` or stop the process using 4000.
- **CORS / 401 on login** – Ensure `CORS_ORIGIN` in `.env` matches the frontend origin (e.g. `http://localhost:3000`).
- **Prisma “schema not in sync”** – Run `pnpm db:migrate` from the repo root (or `pnpm run prisma:migrate` in `apps/api`).
- **MODULE_NOT_FOUND / “prisma not found”** – Run `.\scripts\clean-prisma.ps1` from the repo root, then `pnpm db:generate`.
