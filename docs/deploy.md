# Deploy & CI

How finance-tracker ships: **app deploy from local (Vercel CLI)**, **DB migrations
via GitHub Actions**, **CI gate on every PR/push**. See also
`docs/pre-launch-hardening.md` for the security checklist before going public.

## Database — Neon (Postgres)

Neon gives two connection strings; use the right one for each job:

| Use | Connection | Why |
|---|---|---|
| **App runtime** (`DATABASE_URL` in Vercel) | **Pooled** (host has `-pooler`), `?sslmode=require` | Serverless spins up many instances; the pooler (PgBouncer) keeps DB connections bounded. |
| **Migrations** (`prisma migrate deploy`) | **Direct** (non-pooled), `?sslmode=require` | PgBouncer transaction mode can't run some migration statements. |

## App deploy — local, via Vercel CLI

The Next.js backend (server components, Server Actions, `api/auth/*`) runs as
Vercel Functions (Fluid Compute, full Node.js). Prisma + the pg adapter work on
serverless. No deploy workflow — deploy from your machine:

```bash
npm i -g vercel          # one-time (CLI not installed yet)
vercel login
vercel link              # connect this folder to the Vercel project

# Env (from local — never commit secrets):
vercel env add DATABASE_URL production      # Neon POOLED url + ?sslmode=require
vercel env add AUTH_SECRET production        # a NEW strong secret (bunx auth secret) — don't reuse dev
vercel env add AUTH_GOOGLE_ID production
vercel env add AUTH_GOOGLE_SECRET production
vercel env add AUTH_URL production           # https://<your-domain>
# AUTH_TRUST_HOST=true if behind the platform proxy. Do NOT set DEV_LOGIN_ENABLED
# (it's also hard-disabled when NODE_ENV=production).

vercel            # preview / staging deploy
vercel --prod     # production deploy
```

Also register the prod OAuth callback in Google Cloud Console:
`https://<your-domain>/api/auth/callback/google`.

## CI gate — `.github/workflows/ci.yml`

Runs on every PR and push to `main`: `type-check → lint → test → build` (Bun). No
DB needed (routes are dynamic; build uses placeholder env). This is the gate to
pass before you deploy from local.

## DB migrations — `.github/workflows/db-migrate.yml`

Manual (`workflow_dispatch`) — pick the environment; runs `prisma migrate deploy`.

**One-time setup:** create GitHub **Environments** `staging` and `production`
(repo Settings → Environments). In each, add a secret **`DATABASE_URL`** = that
environment's Neon **DIRECT** url. Optionally add required reviewers on
`production` so a migration there needs an approval.

Run it: Actions → **DB migrate** → Run workflow → choose `staging` or
`production`. Migrations live in `prisma/migrations/` and are applied in order.
