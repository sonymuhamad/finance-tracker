---
id: "0006"
title: "Wallets — CRUD, primary, balance, archive"
status: Implemented # Draft → Approved → In Progress → Implemented
prd: # docs/prd/mvp/005-wallets.md
author: Engineering
created: 2026-06-06
last_updated: 2026-06-06
last_verified: 2026-06-06 # implementation matches this doc (83 tests green)
---

# RFC 0006 — Wallets

> **Accuracy rule:** this RFC must match what's in the code. If the
> implementation changes, update this document in the same change.

## 1. Context

Implements [`005` Wallets & balance](../prd/mvp/005-wallets.md). Wallets hold the
user's real money (cash, bank, e-wallet); their balances are **pooled** into one
total — the **X "Punya sekarang"** the whole "safe to spend" forecast stands on.

This is the **first consumer of the foundation spine** ([RFC
0005](./0005-movement-and-cycle-foundation.md)). The `Wallet` model, the
`Movement` primitive, `deriveBalance` / `adjustmentDelta`, and `toCycleDate`
**already exist and are tested**. So `0006` adds **no new tables and no
migration** — it's the actions + service + UI that turn the dormant `Wallet`
model into a working feature, deriving balances from movements.

**What exists today (foundation, branch `feat/mvp-v0.1`):**

- `model Wallet` — `id userId name type startingBalance isPrimary emoji color
  archivedAt …` (everything PRD 005 needs).
- `features/movements` — `deriveBalance(startingBalance, movements)`,
  `adjustmentDelta(current, target)`, `resolveTiming`, and
  `repository.listActualByWallet(userId, walletId)` (selects `type/status/amount`).
- `features/movements/service.createMovement(input)` — persists a fully-resolved
  movement (used here to record a balance-correction `ADJUSTMENT`).
- `lib/cycle.toCycleDate(date)` — the date-normalization convention.
- The `categories` feature is the structural template (actions/service/repository/
  schema/mapper/defaults/components + seed-on-first-list).

### Locked decisions (from PRD 005)

- **Balance is derived:** `startingBalance` (set at creation, default `0`) + the
  net of the wallet's **ACTUAL** movements. No stored running balance.
- **Manual correction** is recorded as an explicit **ADJUSTMENT** movement (signed
  delta), so history stays reconcilable — never by mutating `startingBalance`.
- **Exactly one primary** wallet at all times; the user can change it.
- **First run** seeds a default **Cash** wallet (`0`, primary).
- **Delete guard:** a wallet with history is **archived**, not hard-deleted; a
  fresh wallet can be deleted outright.
- **Pooled total** is over **active** (non-archived) wallets = X.
- Negative balances aren't specially handled (allowed, no flag).
- Out of scope (later phases): transfers + fees (`i`), rebalance nudges (`j`),
  CC/paylater as wallets (they're obligations — `0008`).

## 2. Design

New feature module `src/features/wallets/`, layered `actions → service →
repository`, composing the spine for balances. No schema change.

### Data model

None. Reuses `model Wallet` from RFC 0005 verbatim. Balances are **not** stored —
they're derived per request from the wallet's `startingBalance` + its ACTUAL
movements (`movements.repository.listActualByWallet`).

### Balance derivation (the core composition)

`walletBalance(w)` = `deriveBalance(Number(w.startingBalance), actualMovements(w))`
where `actualMovements(w)` comes from `movements.repository.listActualByWallet`.
`pooledBalance` = Σ `walletBalance(w)` over **active** wallets.

The summing is extracted as a **pure, unit-tested helper** (mirrors how
`balance.ts` / `projection.ts` keep logic pure):

```ts
// wallets/balance.ts  (pure, no I/O)
type WalletForPool = { id: string; startingBalance: number };
type WalletBalance = { walletId: string; balance: number };

// Groups movements by walletId, runs deriveBalance per wallet, returns
// per-wallet balances + the pooled total.
poolBalances(
  wallets: WalletForPool[],
  movements: { walletId: string; type; status; amount: number }[],
): { perWallet: WalletBalance[]; pooled: number }
```

> **Query shape (MVP):** the service fetches each active wallet's actual
> movements via the existing `listActualByWallet` (one indexed query per wallet,
> run with `Promise.all`). At personal scale (a handful of wallets) this is fine
> and reuses the spine untouched. If it ever bites, replace with a single
> `groupBy([walletId, type])` sum in `movements.repository` (noted in Risks). No
> change to the `movements` module is needed for `0006`.

### Layer flow

**`repository.ts`** (only Prisma for wallets):

| Function | Responsibility |
|---|---|
| `listActive(userId)` | Non-archived, ordered `isPrimary desc, createdAt asc`. |
| `listArchived(userId)` | Archived wallets (for the archive section). |
| `findById(id, userId)` | Scoped fetch (guards). |
| `countByUser(userId)` | Drives first-run seeding. |
| `create(userId, data)` | Insert a non-primary wallet. |
| `createPrimary(userId, data)` | Atomic: unset current primary → insert as primary (mirrors `recurring.createPrimaryIncome`). |
| `update(id, userId, data)` | `name/type/emoji/color` only (never `startingBalance`). |
| `setPrimary(userId, id)` | Atomic unset-then-set among active (mirrors `recurring.setPrimaryIncome`). |
| `archive(id, userId, at)` / `restore(id, userId)` | Toggle `archivedAt`. |
| `remove(id, userId)` | Hard delete (only reached for fresh wallets). |

**`service.ts`** (business logic; composes `movements` + `cycle`):

- `listWallets(userId)` → seeds default Cash on first use (`countByUser === 0`),
  then returns `{ wallets: WalletWithBalance[], pooled, archived }`. Balances via
  `poolBalances` over `listActualByWallet` results.
- `createWallet(userId, input)` → `createPrimary` if it's the user's first/marked
  primary, else `create`. `startingBalance` defaults `0`.
- `updateWallet(userId, id, input)` → `update`; `count === 0` → `DomainError`.
- `setPrimaryWallet(userId, id)` → pre-check target exists & **active**
  (else `DomainError`), then atomic swap. **This is the only way the primary
  changes:** picking wallet B as primary demotes the current primary A to a normal
  wallet in one transaction — there is no "remove primary" path. To delete/archive
  a wallet that is currently primary, the user sets another wallet primary first.
- `adjustBalance(userId, id, targetBalance, note?)` → compute current via
  `deriveBalance`, `delta = adjustmentDelta(current, target)`; if `delta !== 0`,
  `movements.service.createMovement({ type: ADJUSTMENT, status: ACTUAL, amount:
  delta, walletId: id, categoryId: null, paymentMethod: null, occurredAt: now,
  effectiveDate: toCycleDate(now), note })`. (Idempotent no-op when already at
  target. A cleared input is rejected at the action edge — `"" || undefined` →
  Zod error — so it can't silently zero a wallet.)
- `restoreWallet(userId, id)` → `restore`; `count === 0` → `DomainError`. There is
  **no manual archive operation** (per the "one Hapus" product decision):
  archiving happens only as the in-use fallback inside `removeWallet`.
- `removeWallet(userId, id)` → fetch; not found → `DomainError`; **block if
  `isPrimary`** (this single guard also enforces "≥1 active wallet", since the
  last wallet is always primary). Then try `remove`; on **P2003** (in use by a
  movement / card / recurring rule) → `archive` instead and return `{ archived:
  true }`; clean delete returns `{ archived: false }`.

**`actions.ts`** (thin `requireUser` + Zod + `runAction` + `revalidatePath`):
`createWalletAction`, `updateWalletAction`, `setPrimaryWalletAction`,
`adjustWalletBalanceAction`, `restoreWalletAction`,
`deleteWalletAction`. All mutations `revalidatePath("/wallets")` **and**
`revalidatePath("/")` (home shows X). `deleteWalletAction` returns a richer
`{ ok: true; archived: boolean } | { ok: false; error }` so the toast can say
"dihapus" vs "diarsipkan (masih ada riwayat)".

### Server Actions / API — Zod (`schema.ts`)

```ts
walletTypeSchema = z.enum([WalletType.CASH, WalletType.BANK, WalletType.EWALLET])

createWalletSchema = {
  name: string.trim().min(1, "Nama wajib diisi").max(40),
  type: walletTypeSchema,
  startingBalance: coerce.number().min(0).finite().default(0),
  emoji: string.trim().max(8).optional(),
  color: string.regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isPrimary: coerce.boolean().optional(),
}
updateWalletSchema = createWalletSchema.omit({ startingBalance: true, isPrimary: true })
adjustBalanceSchema = {
  targetBalance: coerce.number().min(0).finite(),
  note: string.trim().max(120).optional(),
}
```

No HTTP route handlers — all via Server Actions (matches `categories`).

### UI

- **Route `/wallets`** (App Router, under `(app)`), nav label **"Dompet"** — added
  to `AppShell` NAV (`Wallet` icon, between Beranda and Kategori). Server component
  calls `listWallets`, maps to DTOs, renders `<WalletManager>`.
- **`WalletManager`** (client; mirrors `CategoryManager` — `react-hook-form` +
  Zod, `useTransition`, `sonner` toasts, Radix `Dialog`/`DropdownMenu`):
  - **Pooled header card** — "Punya sekarang" + the big pooled total (the X).
  - **Active wallet list** — emoji avatar, name, **"Utama"** badge on primary,
    derived balance. Per-row overflow menu: *Ubah*, *Jadikan utama* (if not
    primary), *Sesuaikan saldo*, *Hapus*.
  - **Create/Edit dialog** — name, type (Cash/Bank/E-wallet), starting balance
    (create only), emoji, color swatches (reuse the `categories` swatch set).
  - **Adjust dialog** — shows current balance, target-balance input + optional
    note → records the ADJUSTMENT.
  - **Archive section** — collapsible "Arsip" list with *Pulihkan*.
  - **States:** loading (`pending`), empty (never truly empty — seed guarantees
    Cash; still handled), error (toast from `DomainError`).
- Matches the approved hero mockup's "Dompet" block (`docs/mockups/`).

**Home X wiring is deferred to `0009`** (the forecast service composes
`wallets.service` for X). `0006` ships the wallets page + the derived pooled
total; the placeholder home is untouched.

## 3. Alternatives considered

- **Store a running balance column.** Rejected (per 0005) — a second source of
  truth to reconcile on every movement. Derive it.
- **Single `groupBy` sum for all wallets.** One query vs N, but marginal at
  personal scale and pulls new surface into the `movements` module. Deferred as a
  drop-in optimization (Risks). MVP composes the existing `listActualByWallet`.
- **Auto-promote a new primary when the current primary is removed.** Friendlier
  in theory, but a surprising silent side effect on a meaningful choice (the hub).
  Rejected for an explicit guard: you must set another primary first.
- **Separate "delete" vs "archive" buttons in the UI.** Rejected for one *Hapus*
  action that does the right thing (delete if fresh, archive if it has history)
  via the P2003 fallback — no per-wallet "in use" flag needed in the DTO.
- **Edit `startingBalance` directly for corrections.** Rejected — breaks
  reconcilability; corrections go through an ADJUSTMENT movement.

## 4. Risks & trade-offs

- **N+1 balance queries.** One indexed `listActualByWallet` per active wallet.
  Fine at personal scale; swap to a single `groupBy([walletId, type])` sum if it
  ever shows up in profiling. Documented, not premature.
- **Primary invariant.** Enforced in the service inside a transaction (atomic
  unset→set), same pattern as `recurring`. Blocking primary removal is what keeps
  "≥1 active wallet" true without a separate count check.
- **Set-primary on an archived/missing wallet.** Pre-checked in the service
  *before* the atomic swap, so we never unset the old primary and then fail to set
  a new one (which would leave the user with no primary).
- **Adjustment correctness.** The correction reads the *current derived* balance
  and writes a **signed** delta; re-running with the same target is a no-op
  (`delta === 0`). `effectiveDate` is normalized via `toCycleDate` so the
  adjustment lands in the right cycle.
- **Archived wallets & the pool.** Excluded from the pooled total (PRD: active
  only). An archived wallet keeps its movement history (FK `Restrict`); restoring
  re-includes it. (MVP has no transfers, so "money leaving the pool on archive" is
  acceptable and expected.)
- **Money.** `startingBalance` and adjustment amounts are `Decimal` in the DB;
  converted at the boundary with `Number()` and rounded by `deriveBalance`/
  `roundMoney`. Never floats for the stored figures.
- **Negative target.** The "set balance to" input is constrained `≥ 0` (you state
  what you have); the *net* balance can still go negative through expenses — not
  blocked, per PRD.
- **Security.** Every repository query scoped by `userId`; every action
  `requireUser` first.
- **No migration → no destructive risk.** Purely additive feature code.

## 5. Test plan

**Unit (pure):**

- `wallets/balance.ts` `poolBalances`: groups movements by wallet; per-wallet
  derived balance matches `deriveBalance`; pooled = sum of active balances;
  ignores planned movements; wallet with no movements = `startingBalance`; empty
  set = `0`.

**Unit (service, `repository` mocked via `vi.mock`):**

- `listWallets` seeds default Cash exactly once when `countByUser === 0`.
- `adjustBalance`: positive/negative delta records a signed ADJUSTMENT; no-op when
  already at target (no movement created); `effectiveDate` normalized.
- `createWallet`: first wallet (or explicit `isPrimary`) → primary, else not.
- `setPrimaryWallet`: rejects archived/missing target before swapping.
- `removeWallet`: blocks primary; hard-deletes a fresh wallet; falls back to
  archive on P2003 and reports `{ archived: true }`.
- `restoreWallet`: un-archives; `count === 0` → `DomainError`.
- `schema`: `adjustBalanceSchema` rejects a missing/negative target;
  `createWalletSchema` defaults `startingBalance` to `0` and rejects bad types.

**Manual:** first load seeds Cash (primary); add BCA + GoPay; pooled total = sum;
mark BCA primary → "Utama" moves; adjust a balance → reflected + an ADJUSTMENT
recorded; delete a fresh wallet → gone; delete a wallet with history → archived;
restore it → back in the pool; deleting the primary is blocked with a friendly
message.

## 6. Rollout

1. No migration — `Wallet` already exists. (`bun run db:generate` only if the
   client is stale.)
2. Add `src/features/wallets/` (repository, service, balance, schema, types,
   mapper, defaults, actions, `components/wallet-manager.tsx`, `__tests__/`).
3. Add route `src/app/(app)/wallets/page.tsx`; add the **Dompet** nav item to
   `AppShell`.
4. `bun run test` · `type-check` · `lint` green; `/simplify` + `/code-review` on
   the diff.
5. Back-out: delete the feature module + route + nav entry. Nothing persisted
   beyond user-created wallets; no schema to revert.

## 7. Implementation checklist

- [x] `wallets/balance.ts` (`poolBalances`, pure) + tests (6)
- [x] `wallets/repository.ts` (Prisma; primary swap mirrors `recurring`)
- [x] `wallets/service.ts` (seed, CRUD, set-primary, adjust, restore,
      remove-with-P2003-fallback) + tests (20)
- [x] `wallets/schema.ts` + `types.ts` + `mapper.ts` + `defaults.ts` + schema tests (5)
- [x] `wallets/actions.ts` (thin; `revalidatePath` `/wallets` + `/`)
- [x] `wallets/components/wallet-manager.tsx` (list/create/edit/adjust/restore)
- [x] Route `app/(app)/wallets/page.tsx` + **Dompet** nav item in `AppShell`
- [x] `bun run test` (83) · `type-check` · `lint` clean
- [x] `/simplify` + `/code-review` run on the diff (footgun fix: cleared adjust
      input can't silently zero a wallet)
- [x] This RFC updated to match final code; `last_verified` set; status →
      `Implemented`
- RFC `0005` stays `In Progress`: `0006` is its first consumer, but its forecast
  service (`0009`) + create/confirm orchestration (`0007`/`0008`) are still
  pending. It flips to `Implemented` once those land.
