@AGENTS.md

# CLAUDE.md — finance-tracker

Personal finance tracker web app. Built incrementally (MVP → phases), docs-first.

> **North star:** Recording personal finances should be fast, easy, and
> phone-friendly — without the friction of a spreadsheet.

## How we work (read this first)

This project is **docs-first and agile**. Two non-negotiable rules:

1. **Every feature has a PRD** (`docs/prd/`) before any code. No `Approved` PRD → no code.
2. **Every feature has an RFC** (`docs/rfc/`) and the **RFC must stay accurate to
   the code**. If implementation changes, update the RFC in the same change.

Personas live as local skills — use them:

- **`pm`** — Lead PM persona: PRDs, phasing, scope.
- **`eng`** — Lead Engineer persona: RFCs, implementation, clean code.
- **`new-feature`** — orchestrates `PRD → phase → RFC → plan → implement → sync-docs`.

Start any new feature with **`/new-feature <name>`**.

Key docs:
- `docs/prd/000-product-vision.md` — vision
- `docs/roadmap.md` — phasing (source of truth)
- `docs/superpowers/specs/2026-06-01-finance-tracker-foundation-design.md` — architecture

## Commands

| Command | What |
|---|---|
| `bun dev` | Dev server |
| `bun run build` | Production build |
| `bun run test` | Vitest (run once) · `bun run test:watch` to watch |
| `bun run type-check` | `tsc --noEmit` |
| `bun run lint` | Biome check · `bun run format` to write |
| `bun run db:migrate` | Prisma migrate dev |
| `bun run db:generate` | Regenerate Prisma client |
| `bun run db:studio` | Prisma Studio |

Always run `test`, `type-check`, and `lint` before considering work done.

## Tech stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router) + Server Actions |
| Language | TypeScript (strict) |
| ORM / DB | Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL (local) |
| Auth | Auth.js (NextAuth v5) — Google OAuth + dev-login |
| Validation | Zod |
| Client state | Zustand |
| Data fetching | Server Actions + SWR |
| Forms | react-hook-form + Zod |
| UI | Tailwind + Radix (`components/ui/`) |
| Lint/Format | Biome |
| Test | Vitest + React Testing Library |
| Runtime / PM | Bun |

## Architecture — feature-modular + layered

Mirrors `Satu-Dental-CMS-BE` (`handler → usecase → repository`):

```
src/
  app/             # App Router: routes, layouts, route handlers (api/)
  features/<domain>/
    actions.ts     # Server Actions (entry): auth + Zod validation → service
    service.ts     # Business logic (usecase): testable, no HTTP/Prisma
    repository.ts  # Data access: the ONLY layer importing Prisma
    schema.ts      # Zod DTOs
    components/  __tests__/
  components/ui/   # shared atomic components
  lib/             # prisma.ts, auth.ts, money.ts, utils.ts
  config/ const/ styles/ types/
  generated/prisma # Prisma client output (do not edit; gitignored)
```

**Dependency direction:** `actions → service → repository`. Never reversed,
never skipped. Prisma is imported only in `repository.ts` (and `src/lib/prisma.ts`).
See `src/features/README.md`.

## Conventions

- Money: use `src/lib/money.ts`; store as `Decimal`, never use floats for totals.
- Prisma client: import from `@/lib/prisma`. Auth: from `@/lib/auth`.
- Every domain record is owned by an authenticated `userId`.
- Keep files focused and small; match the style of surrounding code.

## Local dev database

Local Postgres (same setup as Satu-Dental-CMS-BE). `DATABASE_URL` is in `.env`
(not committed). First-time setup: `createdb finance_tracker` then `bun run db:migrate`.

## Git

Repo-local identity: `sonymuhamad <sonyfadhil11@gmail.com>` (set with
`git config --local`, not global).
