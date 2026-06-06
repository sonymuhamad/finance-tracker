# Handover — finance-tracker

_Last updated: 2026-06-06_

A living handover doc to resume work in a fresh session. For the "why/how we
work", see `CLAUDE.md`, `docs/roadmap.md`, and `docs/prd/000-product-vision.md`.

---

## ⚠️ Major pivot (2026-06-05)

The product was **reframed** from a _retrospective_ tracker ("where did my money
go?") to a **forward-looking cash-flow forecaster** answering **"how much can I
safely spend before my next paycheck?"** Root pain: running out mid-cycle →
_pinjol_. The original MVP v0.1 (auth + record + categories + dashboard, on branch
`feat/mvp-v0.1`) was built on the OLD model and is being **re-spec'd**.

**`docs/prd/000-product-vision.md` + `docs/roadmap.md` are rewritten and current.**
This handover and the new MVP PRDs reflect the pivot.

## The locked model (the spine)

- Money lives on **payday cycles**, anchored to the **primary recurring income**
  (data-driven — change its date, the cycle follows). Holiday wobble ignored.
- Two states: **committed-but-unpaid** (recurring, CC/paylater bills, plans) vs
  **actually-moved** (cash now, executed). **Payment method decides when** a
  movement crosses over.
- **Wallets** (cash/debit/e-wallet) hold real money, **pooled** into one total.
  **CC & paylater are NOT wallets** — they make future obligations paid _from_ a
  wallet at the due date.
- **Home spine:** X (have now) − Y (obligations due this cycle) = Z (safe to
  spend) + per-wallet breakdown; a **cycle switcher** projects forward.

## Where we are

- ✅ **Vision + roadmap rewritten.** MVP features now **a–f**.
- ✅ **Hero mockups approved** — `docs/mockups/mvp-hero-screens.html` (Beranda
  X→Y→Z + Catat-cepat with a live "impact preview"). Built in the real theme —
  open it in a browser (`open docs/mockups/mvp-hero-screens.html`).
- **MVP PRDs (`docs/prd/mvp/`) — ALL ✅ Approved (2026-06-06):**
  - `005` Wallets & balance · `006` Income & payday cycle · `007` Expenses &
    obligations · `008` Home — safe to spend. Each links `rfc: "0005"`.
  - `004` Auth foundation — carries over from old MVP. `001–003` superseded.
- ✅ **RFC `0005` — Foundation: Movement + Cycle** written + Approved + the
  **foundation is implemented and green** (type-check + lint + **52 tests**). It's
  the shared spine for all four PRDs. Status `In Progress` (flips to `Implemented`
  once the feature RFCs consume it). `/simplify` + `/code-review` have been run and
  their fixes applied.

### What's built (branch `feat/mvp-v0.1`, all **uncommitted**)

- `prisma/schema.prisma` rebuilt: enums + `Wallet`/`Card`/`RecurringRule`/`Movement`,
  `Category.type`→`MovementType`, `Transaction` dropped. Two migrations:
  `add_cashflow_foundation` + `restrict_category_delete` (dev DB was reset).
- `src/lib/cycle.ts` — pure payday-cycle math (+ `toCycleDate` normalizer).
- `src/features/movements/` — `balance.ts` (deriveBalance/resolveTiming/adjustmentDelta) + repository + service primitives.
- `src/features/recurring/` — `projection.ts` (projectOccurrences, no double-count) + repository + service (atomic primary-income singleton).
- `categories` migrated to `MovementType`; old `transactions`/`dashboard` removed;
  home is a placeholder (real home in `0009`).

Working mode: Claude is dual-hat **Lead PM** (`pm`) + **Lead Engineer** (`eng`);
Sony decides. Strict docs-first: PRD → RFC → plan → implement → sync-docs; the RFC
stays accurate to the code.

Key decisions locked: CC billing = **middle path**; receipt/payment confirms are
**manual one-tap** (no push yet); recurrence is **monthly only** in MVP. Foundation
impl: singleton primaries enforced in-service (not DB index); **ADJUSTMENT amount is
a signed delta**; `effectiveDate` is the cycle axis; balances **derived**; all
cycle-aligned dates normalized via `toCycleDate`; **a category/wallet in use can't be
deleted** (FK `Restrict` + friendly error).

⚠️ **Open product decision (for `0007`):** a primary-income payday on the **29th–31st**
shortens cycles in short months, so a recurring occurrence can drop/double. MVP plan:
constrain the **primary-income day-of-month to 1–28** in `0007`'s Zod (anchors ≤28 are
always clean); revisit end-of-month paydays later. Logged in `0005` Risks.

## Next steps (resume after 2026-06-06)

Foundation (`0005`) is done. Build the per-feature RFCs that consume the spine,
in order — each: PRD already Approved → write RFC → TDD implement → sync docs:

1. **`0006` Wallets** — CRUD + set-primary + archive; **`walletBalance` /
   `pooledBalance`** here (compose `movements.repository` + `deriveBalance` with the
   wallet's `startingBalance`). First consumer of the spine.
2. **`0007` Income** — primary recurring (anchors cycle) + one-off/forward + tags +
   one-tap confirm. **Enforce primary-income `dayOfMonth` 1–28 in Zod** (see open
   decision above).
3. **`0008` Expenses & obligations** — cards + payment-method timing + impact
   preview + confirm.
4. **`0009` Home** — forecast service X→Y→Z + cycle switcher + projection UI +
   "perlu konfirmasi". Replaces the placeholder home; honors the `CycleForecast`
   contract in `0005`.

Then flip `0005` → `Implemented`. Also pending: **commit** the (uncommitted)
planning docs + foundation once Sony's manual smoke-test passes.

## How to resume (local setup)

```bash
cd ~/Documents/personal-project/finance-tracker
git checkout feat/mvp-v0.1
bun install                         # postinstall runs `prisma generate`

# Local Postgres must be running (Homebrew):
brew services start postgresql@14   # if not already running
# DB `finance_tracker` exists; DATABASE_URL is in .env (not committed).
bun run db:migrate                  # apply pending migrations (no-op if none)

bun dev                             # http://localhost:3000 → dev-login (email only)
```

Key commands: `bun run test` · `bun run type-check` · `bun run lint`
(`bunx biome check --write` to autofix) · `bun run db:studio`.

**Env:** `.env` holds `DATABASE_URL` (local Postgres, user `sony`, db
`finance_tracker`), `AUTH_SECRET` (dev placeholder), `DEV_LOGIN_ENABLED=true`.
`.env` is gitignored; `.env.example` is the template.
**Git identity** (repo-local): `sonymuhamad <sonyfadhil11@gmail.com>`.

## Stack & conventions (quick recall)

- **Next.js 16** (App Router + Server Actions), TypeScript strict, **Bun**.
- **Prisma 7** (`@prisma/adapter-pg`) + **local PostgreSQL**.
- **Auth.js v5**, **Zod**, **shadcn/ui** (radix base), **Biome**, **Vitest**.
- Theme **"warm & friendly"** — cream/coral, **Bricolage Grotesque** + **Nunito**,
  generous radius, light-only.
- Layering per feature **`actions → service → repository`**; Prisma only in
  `repository.ts` (+ `src/lib/prisma.ts`); every record scoped to `userId`.

## Next-session prompt (paste this to start fresh)

> Lanjut **finance-tracker**. Baca dulu `docs/HANDOVER.md`,
> `docs/prd/000-product-vision.md`, dan `docs/roadmap.md`. Produk udah **dipivot**
> jadi **cash-flow forecaster** ("aman dipakai sampe gajian" — model **X − Y = Z**
> di atas siklus gajian, metode bayar nentuin timing). Kamu tetap dual-hat **Lead
> PM** (`pm`) + **Lead Engineer** (`eng`), aku decision-maker; alur docs-first
> (PRD → RFC → plan → implement → sync-docs), RFC harus akurat sama kode.
>
> Status: **semua MVP PRD (`005`–`008`) Approved**; **RFC `0005` (Foundation:
> Movement + Cycle) udah diimplement & ijo** (52 test, type-check, lint) tapi
> **belum di-commit** di `feat/mvp-v0.1`. Spine: `lib/cycle.ts`,
> `features/movements`, `features/recurring`. Lanjut dari **RFC `0006` Wallets**
> (consumer pertama — `walletBalance`/`pooledBalance` di sini), terus `0007`
> income → `0008` expenses → `0009` home. Catatan: batasi `dayOfMonth` gaji-primary
> ke 1–28 di Zod `0007` (lihat open decision). Cek `docs/rfc/0005-*` + `MEMORY`.
