# Handover — finance-tracker

_Last updated: 2026-06-02_

A living handover doc to resume work in a fresh session. For the "why/how we
work", see `CLAUDE.md`, `docs/roadmap.md`, and the foundation design in
`docs/superpowers/specs/`.

---

## Where we are

**MVP v0.1 is complete and committed** on branch **`feat/mvp-v0.1`** (not yet
merged to `main`; `main` holds the scaffold/foundation commit).

Working modes: Claude acts as **Lead PM** (`pm` skill) + **Lead Engineer**
(`eng` skill); Sony is the decision-maker. Every feature follows the strict
**`/new-feature`** pipeline: PRD → phase → RFC → plan → implement → sync-docs.

### Done (MVP v0.1)
- **Auth** (PRD/RFC 004): Google OAuth + email-only **dev-login** (gated by
  `DEV_LOGIN_ENABLED`), JWT session, route protection in `(app)/layout.tsx`,
  app shell + mobile bottom-nav.
- **Categories** (002): CRUD + default seeding, type-scoped, in-use delete guard.
- **Transactions** (001): create/edit/delete, category+type validation, fast
  mobile form, list grouped by day.
- **Dashboard** (003): monthly income/expense/net + expense-by-category
  breakdown + month switcher.

All PRDs/RFCs are marked **Implemented**; roadmap MVP row is ticked.

### Verified green
`tsc --noEmit` · Biome · Vitest (26 tests) · `next build` · runtime boot +
auth-guard · end-to-end data-layer smoke test (`bun run scripts/smoke.ts`).

---

## Stack & conventions (quick recall)

- **Next.js 16 (App Router + Server Actions)**, TypeScript strict, **Bun**.
- **Prisma 7** (driver adapter `@prisma/adapter-pg`) + **local PostgreSQL**.
- **Auth.js v5** (NextAuth), **Zod**, **shadcn/ui** (radix base), **Biome**, **Vitest**.
- Theme: **"Warm & friendly"** — cream/coral, generous radius, fonts
  **Bricolage Grotesque** (heading) + **Nunito** (body). Light theme only.
- Layering per feature: **`actions → service → repository`**; Prisma is imported
  **only** in `repository.ts` (+ `src/lib/prisma.ts`); every mutation scoped to
  the authenticated `userId`. See `src/features/README.md`.
- Shared: `src/lib/{prisma,auth,money,utils,errors,action}.ts`.

---

## How to resume (local setup)

```bash
cd ~/Documents/personal-project/finance-tracker
git checkout feat/mvp-v0.1
bun install                         # postinstall runs `prisma generate`

# Local Postgres must be running (Homebrew):
brew services start postgresql@14   # if not already running
# DB `finance_tracker` already exists; DATABASE_URL is in .env (not committed).
bun run db:migrate                  # apply any pending migrations (no-op if none)

bun dev                             # http://localhost:3000 → sign in via dev-login (email only)
```

Key commands: `bun run test` · `bun run type-check` · `bun run lint`
(`bunx biome check --write` to autofix) · `bun run db:studio`.

**Env note:** `.env` holds `DATABASE_URL` (local Postgres, user `sony`, db
`finance_tracker`), `AUTH_SECRET` (dev placeholder), `DEV_LOGIN_ENABLED=true`.
`.env` is gitignored; `.env.example` is the template.

**Git identity** (repo-local): `sonymuhamad <sonyfadhil11@gmail.com>`.

---

## Next steps (pick one)

1. **Review & merge** `feat/mvp-v0.1` → `main` (review `git diff main..feat/mvp-v0.1`),
   optionally `bun dev` walkthrough first.
2. **Phase 1 — Multi-wallet (v0.2)**: wallets (cash/bank/e-wallet) + per-wallet
   balance + transfers. Start with `/new-feature multi-wallet` (needs a new
   Prisma model + migration; transactions gain a `walletId`).
3. **Polish backlog** (small, optional): replace `confirm()` delete dialogs with
   shadcn `AlertDialog`; revisit transaction-form quick-entry reset.

## Known follow-ups / gotchas
- shadcn **`form`** component isn't in the radix-base registry — we use
  react-hook-form + primitives directly. Drop in a wrapper later if wanted.
- `next-themes` is still in `package.json` (added by shadcn) but unused after we
  hardcoded the Toaster to light — safe to remove.
- Delete confirmations use the browser `confirm()` (functional, not pretty).
- Transaction form intentionally keeps last type/category for quick repeat entry.
- Month boundaries are **UTC** (matches how `occurredAt` is stored) — revisit
  timezone handling before opening to other users.
- `scripts/smoke.ts` is a dev-only data-layer check (creates+deletes a temp user).

---

## Next-session prompt (paste this to start fresh)

> Lanjut project **finance-tracker** (personal finance web app, docs-first,
> incremental). Baca dulu `docs/HANDOVER.md`, `CLAUDE.md`, dan `docs/roadmap.md`
> buat konteks. Kamu tetap dual-hat: **Lead PM** (`pm` skill) + **Lead Engineer**
> (`eng` skill), aku decision-maker. Tiap fitur ikut alur **`/new-feature`**
> (PRD → phase → RFC → plan → implement → sync-docs), dan RFC harus akurat sama
> kode.
>
> Status: **MVP v0.1 selesai** di branch `feat/mvp-v0.1` (auth, kategori,
> transaksi, dashboard) — semua test/build hijau. Stack: Next.js 16 App Router +
> TS + Prisma 7 + Postgres lokal + Auth.js + shadcn/ui, tema "warm & friendly".
>
> Hari ini aku mau: **[PILIH — mis. "review & merge MVP ke main" / "mulai Phase 1
> multi-wallet" / "rapihin backlog polish (AlertDialog, dll)"]**. Mulai dengan
> ngecek state (git branch, build/test), terus jalan sesuai pilihan itu.
