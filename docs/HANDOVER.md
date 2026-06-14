# Handover — finance-tracker

_Last updated: 2026-06-07_

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

### What's built (branch `feat/mvp-v0.1`, committed as `3871b24`, not merged)

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

**✅ MVP FEATURE-COMPLETE (2026-06-06).** All feature RFCs `0006`–`0009`
implemented; `0005` foundation flipped to `Implemented` (spine fully consumed).
**125 tests green**, type-check + lint + `bun run build` clean; each feature
`/simplify` + `/code-review`'d with fixes applied. On `feat/mvp-v0.1`, **NOT yet
committed** — pending Sony's review + manual smoke-test.

Shipped this session:

1. ✅ **`0006` Wallets** — `src/features/wallets/`, route `/wallets`. `poolBalances`
   (= X) composes `movements.repository` + `deriveBalance`; manual correction = signed
   ADJUSTMENT; primary = atomic swap (no "remove primary"); delete auto-archives
   in-use (P2003). Review fix: cleared adjust input can't silently zero a wallet.
2. ✅ **`0007` Income** — `src/features/income/` (orchestration, no table), route
   `/income`. Primary recurring (anchors cycle, day 1–28) upsert-in-place; secondary
   recurring + one-off/forward; one-tap confirm. Spine additions: `recurring.update`/
   `updateRule`, `movements.findByRuleOnDate` (confirm idempotency). Review fixes:
   confirm count-guard + materialize dup-guard, UTC→local date default.
3. ✅ **`0008` Expenses & obligations** — `src/features/{cards,expenses}/`, route
   `/expenses`. Cards (CC/paylater) CRUD; `recordExpense` uses `resolveTiming` +
   `nextDueDate` (cash now / CC·paylater on due date); recurring obligations;
   client-side **impact preview** (pure `lib/cycle`); confirm/materialize. Review:
   `toProjectionRule` shared into `recurring/projection`; recurring obligation
   materializes `paymentMethod: null`. (Single-occurrence **skip deferred** to Phase 1.)
4. ✅ **`0009` Home** — `src/features/home/`, real Beranda at `/`. Pure
   `computeForecast` (X−Y=Z; current vs projected-opening); `getCycleForecast`
   composes everything; cycle switcher (current + 12 forward; **past dropped** —
   needs opening-balance reconstruction); "perlu konfirmasi" reuses `0007`/`0008`
   confirm actions. Review: `toConfirm` in-cycle guard; page reuses the service's
   wallet data (no double `listWallets`); shared `formatDateShort` → `lib/date`.

Nav now: Beranda · Dompet · Pemasukan · Pengeluaran · Kategori.

### Original per-feature plan (all done)

- **`0007` Income** — primary recurring (anchors cycle) + one-off/forward + tags +
   one-tap confirm. **Enforce primary-income `dayOfMonth` 1–28 in Zod** (see open
   decision above).
3. **`0008` Expenses & obligations** — cards + payment-method timing + impact
   preview + confirm.
4. **`0009` Home** — forecast service X→Y→Z + cycle switcher + projection UI +
   "perlu konfirmasi". Replaces the placeholder home; honors the `CycleForecast`
   contract in `0005`.

Then flip `0005` → `Implemented`. The foundation is **committed** (`3871b24`) but
Sony **hasn't run the manual smoke-test yet** — verify the app still runs (login,
categories CRUD, placeholder home, nav) when convenient; fix forward if anything broke.

## Next session — polish & fixes plan (from smoke-test 2026-06-07)

Source list: **`docs/polish-backlog.md`** (items #1–#6). Sony will implement these
next session. Two already-applied this session: the **currency hydration fix**
(`formatCurrency` normalizes the NBSP) and the **home cycle switcher** (long chip
strip → compact dropdown pill). Everything below is **planned, not yet done**.

> ⚠️ **Do NOT manually edit the dev DB.** The smoke-test left a wrongly-recorded
> cash expense (balance shows `-Rp624.000`). It gets cleaned up *through the
> delete feature* built in Batch C below — or a `db:migrate reset` if you want a
> clean slate. No Prisma Studio hand-edits.

Work in batches, cheapest/lowest-risk first. Each batch = TDD where logic exists,
then `test`+`type-check`+`lint`+`build`, then `/simplify`+`/code-review`, then sync
the touched RFC(s).

### Batch A — notes ✅ DONE (2026-06-07; backlog #4 + #5)

**Shipped.** Note now appended to the item subtitle (home "Jatuh tempo" +
"Perlu konfirmasi", expenses list, income list) so same-tag items are
distinguishable; `note` threaded `ForecastEvent → ForecastItemDTO → mapper →
HomeView` (projected occurrences carry no note, mirroring `expenses.listExpenses`).
`noteField` cap lowered **120 → 50** in income/expenses/wallet-adjust schemas.
Gate green (125 tests · type-check · lint · build); RFCs `0007`/`0008`/`0009`
synced (0009 `ForecastEvent` gained `note`; also fixed pre-existing 0009 drift —
strip is `back: 0`, offset clamp `0…12`, matching the code). Not yet committed
(per Sony: fix more first, then commit). Original plan below, for reference:

- **#5** lower the Zod `noteField` cap **120 → 50** chars in `income/schema.ts`,
  `expenses/schema.ts`, and the wallet adjust note (`wallets/schema.ts`).
- **#4** render the **note** in the item lists (it's saved but never shown):
  home obligations (`home-view.tsx`), expenses list (`expense-manager.tsx`),
  income list (`income-manager.tsx`). Show note in the subtitle (prefer/append to
  tag) so same-tag items (e.g. two "Ortu") are distinguishable. Note → the DTOs
  already carry it? check: `ExpenseItem`/`IncomeItem` have `note`; `ForecastEvent`
  does **not** → add `note` to `ForecastEvent` + the home mapper if home should show it.
- RFC sync: `0007`/`0008` (+ `0009` if `ForecastEvent` gains `note`).

### Batch B — reusable inputs (polish; backlog #1 + #2)

- **#2 currency input** — a reusable client component: `Rp` prefix + live
  thousand-grouping (**id-ID dots**, `Rp 1.000.000`, consistent w/ `formatCurrency`;
  confirm dot-not-comma w/ Sony), stores the raw number, submits digits only,
  `inputMode="numeric"`, no spinner. Swap into every amount field (income, expense,
  wallet start + adjust, recurring obligation).
- **#1 date picker** — replace native `<input type="date">` (ugly OS popup) with a
  styled picker (Radix Popover + a small day-grid, or a day-of-month picker).
  Fields: one-off income date, expense tx date, expense due date.
- Pure UI → no RFC, but note the new shared components in `src/components/ui` or
  `components/`.

### Batch C — expenses management + planned expense (functional; backlog #3 + #6)

This is the meatiest and unblocks the stuck `-624k` state. **Update RFC `0008`**
(and touch `0009` for the home), TDD the service additions.

- **#3a cycle switcher on `/expenses`** — `listExpenses` already takes `offset`;
  add the same dropdown-pill switcher as the home (`?offset` searchParam on the
  expenses page) so future-cycle items are viewable/manageable.
- **#3b edit + delete one-off expenses** — wire `movements.service.deleteMovement`
  (already exists) + a new `updateMovement` path (amount/category/date/note; for a
  PLANNED obligation also amount/due). Add per-row edit/delete in the expenses list.
  Likely also want the same edit/delete on the **income** list (`0007`).
- **#6 planned (future) one-off expense** — add an **"belum dibayar / rencana"
  toggle** to the expense capture, symmetric with income's "sudah diterima". When
  off (+ method cash): record **PLANNED** on its `effectiveDate` → lands in that
  cycle's **Y "Bakal keluar"**, does **not** deduct the wallet until confirmed
  "Bayar" (reuses `confirmObligation`). This is the principled fix for "I want to
  log a future expense without it hitting my balance now" — *don't* manual-adjust
  the balance, and *don't* force it to CC/paylater unless it's actually card-paid.

**Open decisions to confirm before coding Batch C:**
- #6: confirm the planned-expense toggle approach (Sony leaned yes). Note: a
  future-dated *cash* expense currently still reduces today's balance because
  `deriveBalance` sums all ACTUAL regardless of date — the PLANNED path sidesteps
  this without changing `deriveBalance`.
- #3b: which fields are editable on an already-PLANNED obligation; delete-confirm UX
  (native `confirm()` like elsewhere, or a styled dialog).
- #2: dot vs comma grouping (recommended: dot / id-ID, matches the rest of the app).

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
