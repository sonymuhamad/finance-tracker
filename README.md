# finance-tracker

A personal finance tracker web app — record income/expenses fast, from your
phone, and see where the money goes. Built incrementally (MVP → phases),
docs-first.

> **North star:** Recording personal finances should be fast, easy, and
> phone-friendly — without the friction of a spreadsheet.

## Stack

Next.js 16 (App Router + Server Actions) · TypeScript · Prisma 7 + PostgreSQL ·
Auth.js (Google + dev-login) · Zod · Zustand · SWR · Tailwind + Radix · Biome ·
Vitest · Bun.

## Getting started

Prerequisites: [Bun](https://bun.sh), a local PostgreSQL, Node 18+.

```bash
# 1. Install deps
bun install

# 2. Configure env
cp .env.example .env        # then fill DATABASE_URL + AUTH_SECRET

# 3. Create the database and run migrations
createdb finance_tracker
bun run db:migrate

# 4. Run
bun dev                     # http://localhost:3000
```

In local dev, sign in with the email-only **dev-login** (no Google setup needed)
— gated behind `DEV_LOGIN_ENABLED=true`.

## Scripts

```bash
bun dev              # dev server
bun run build        # production build
bun run test         # vitest (run once)
bun run type-check   # tsc --noEmit
bun run lint         # biome check
bun run db:migrate   # prisma migrate dev
bun run db:studio    # prisma studio
```

## Architecture

Feature-modular + layered (`actions → service → repository`), mirroring the
clean architecture of `Satu-Dental-CMS-BE`. See `src/features/README.md` and
`CLAUDE.md`.

## How we work — docs-first

Every feature gets a **PRD** (`docs/prd/`) and an **RFC** (`docs/rfc/`); the RFC
stays accurate to the code. Phasing lives in `docs/roadmap.md`. Start a feature
with `/new-feature <name>` (Claude Code), which enforces
`PRD → phase → RFC → plan → implement → sync-docs`.

- Vision: `docs/prd/000-product-vision.md`
- Roadmap: `docs/roadmap.md`
- Foundation design: `docs/superpowers/specs/2026-06-01-finance-tracker-foundation-design.md`
