# LifeOps — Production Deployment

Docker-only deployment. No Node.js, npm, or pnpm is required on the production host.

## Prerequisites

1. Copy `.env.example` to `.env` and set:
   - `DATABASE_URL` — Neon PostgreSQL connection string (`?sslmode=require`)
   - `JWT_SECRET` — strong random secret
   - `PORT` — backend port (default `3000`, must match Caddyfile)
   - `FRONTEND_DOMAIN`, `API_DOMAIN`, `ACME_EMAIL`
   - `EXPO_PUBLIC_API_URL`, `FRONTEND_ORIGIN`

2. Open host ports **80** and **443** for Caddy.

## Database migrations

Schema changes are versioned in `lib/db/drizzle/` and applied non-interactively in Docker.

| Command | Purpose |
|---------|---------|
| `pnpm --filter @workspace/db run generate` | Generate a new SQL migration after schema changes (dev machine) |
| `docker compose run --rm migrate` | Apply pending migrations in production |

**Never use `drizzle-kit push` in production.** It can prompt for interactive input when drift is detected.

`DATABASE_URL` must point to a **dedicated LifeOps Neon database**. If another application's `public.users` table already exists (for example with `email` / `phone_number` columns), migrations will refuse to baseline and the API will not start until a clean LifeOps database is used.

The migrate container:

1. Reads `DATABASE_URL` from root `.env`
2. Baselines databases that were previously provisioned with `push` (marks committed migrations as applied without recreating tables)
3. Runs `drizzle-kit migrate` for any pending migrations
4. Exits `0` when complete

Commit every file under `lib/db/drizzle/` after running `generate`.

## Deploy

```bash
docker compose build
docker compose run --rm migrate
docker compose up -d
```

`backend` depends on `migrate` completing successfully, so `docker compose up -d` also runs migrations before starting the API.

## Verify

```bash
docker compose ps -a          # migrate → Exited (0)
docker compose logs migrate   # "Migrations complete."
docker compose logs backend   # "Server listening"
```

## Schema change workflow (developer)

```bash
# 1. Edit lib/db/src/schema/index.ts
# 2. Generate migration SQL
pnpm --filter @workspace/db run generate

# 3. Commit lib/db/drizzle/*
# 4. Deploy (commands above)
```
