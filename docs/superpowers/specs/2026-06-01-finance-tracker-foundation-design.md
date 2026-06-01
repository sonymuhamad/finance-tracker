# Finance Tracker — Foundation & Ways-of-Working Design

**Date:** 2026-06-01
**Status:** Approved (foundation)
**Authors:** Sony (Lead PM / Lead Eng) + Claude (PM + Eng personas)

This is the foundation spec: it defines the product framing, architecture,
documentation discipline, local skills, and phasing. Individual features get
their own PRD (`docs/prd/`) and RFC (`docs/rfc/`).

---

## 1. Product framing

- **What:** a personal finance tracker web app — record income/expenses fast,
  from a phone, and see where the money goes.
- **Why:** spreadsheets are too fiddly, especially on mobile.
- **Who:** the author first; opened to friends at Release v0.0.1 (multi-user by
  design — every record owned by a `userId` from day one).
- **North star:** _Recording personal finances should be fast, easy, and
  phone-friendly — without the friction of a spreadsheet._

Full vision: [`../../prd/000-product-vision.md`](../../prd/000-product-vision.md).

## 2. Architecture (Option A — single Next.js app, feature-modular + layered)

One full-stack Next.js app (App Router + Server Actions). Code is organized by
**domain feature**, each with a clean layering that mirrors `Satu-Dental-CMS-BE`
(`handler → usecase → repository`):

```
features/<domain>/
  actions.ts     # Server Actions (entry): auth + Zod validation → service
  service.ts     # Business logic (usecase): pure-ish, testable
  repository.ts  # Data access: the only layer importing Prisma
  schema.ts      # Zod DTOs
  components/     __tests__/
```

**Dependency direction:** `actions → service → repository`, never reversed,
never skipped. Rejected alternatives: thin "simple Next" (business logic leaks
into actions; doesn't stay clean), and a NestJS monorepo (overkill for solo MVP,
wastes Server Actions).

## 3. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + Server Actions |
| Language | TypeScript (strict) |
| ORM / DB | Prisma 7 (driver adapter `@prisma/adapter-pg`) + PostgreSQL |
| Database (dev) | Local Postgres (same setup as Satu-Dental-CMS-BE) |
| Auth | Auth.js (NextAuth v5) — Google OAuth + email-only dev-login |
| Validation | Zod |
| Client state | Zustand |
| Data fetching | Server Actions + SWR (client reads) |
| Forms | react-hook-form + Zod |
| UI | Tailwind + Radix primitives (`components/ui/`) |
| Lint/Format | Biome |
| Test | Vitest + React Testing Library |
| Runtime / PM | Bun |

## 4. Data model (MVP)

Auth.js adapter models (`User`, `Account`, `Session`, `VerificationToken`) plus
domain models `Category` and `Transaction` (enum `TransactionType`). Money is a
fixed-precision `Decimal(18,2)`. Multi-wallet, recurring, and budgets are **not**
in the schema yet — they arrive with their own RFC + migration.

See `prisma/schema.prisma` (source of truth).

## 5. Documentation discipline (the strict rule)

1. **Every feature has a PRD** (`docs/prd/NNN-*.md`) — problem, goals, non-goals,
   user stories, scope, success metric, phase. No Approved PRD → no code.
2. **Every feature has an RFC** (`docs/rfc/NNNN-*.md`) — and the **RFC must stay
   accurate to the code**. Behavior changes update the RFC in the same change.
3. **Lifecycle** in frontmatter: `Draft → Approved → In Progress → Implemented`,
   with `last_verified` on RFCs.
4. **Traceability:** RFC links its PRD; both link to code.

## 6. Local skills (`.claude/skills/`)

- **`pm`** — senior-PM persona: writes/updates PRDs, decides phasing, guards scope.
- **`eng`** — senior-engineer persona: writes/updates RFCs, enforces the layering
  and clean code, runs `/simplify` + `/code-review`, keeps RFC ≈ implementation.
- **`new-feature`** — orchestrator enforcing `PRD → phase → RFC → plan →
  implement → sync-docs`.

## 7. Phasing

See [`../../roadmap.md`](../../roadmap.md).

- **MVP (v0.1):** auth foundation · record transactions · categories · dashboard summary.
- **Phase 1 (v0.2):** multi-wallet + balances + transfers.
- **Phase 2 (v0.3):** recurring transactions · budgets + alerts.
- **Release v0.0.1:** hosting, production hardening, open to friends.

PM note: the user initially wanted multi-wallet (c) and recurring (f) in the MVP;
we agreed to a leaner MVP so daily use lands sooner, with c and f one step out.

## 8. Decisions log

- Auth from day one (OAuth2 / Google), email-only dev-login for dev/staging.
- Hosting deferred to Release v0.0.1.
- App Router (for Server Actions).
- Local Postgres for dev (no Docker), matching Satu-Dental-CMS-BE.
- Git identity for this repo: `sonymuhamad <sonyfadhil11@gmail.com>` (repo-local).
