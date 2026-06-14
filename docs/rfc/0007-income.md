---
id: "0007"
title: "Income & payday cycle"
status: Implemented # Draft → Approved → In Progress → Implemented
prd: # docs/prd/mvp/006-income-and-cycle.md
author: Engineering
created: 2026-06-06
last_updated: 2026-06-07
last_verified: 2026-06-14 # implementation matches this doc (153 tests green; one-off edit/delete (PLANNED only, lock-paid) + future-cycle confirm guard)
---

# RFC 0007 — Income & payday cycle

> **Accuracy rule:** this RFC must match what's in the code. If the
> implementation changes, update this document in the same change.

## 1. Context

Implements [`006` Income & payday cycle](../prd/mvp/006-income-and-cycle.md).
Income is the **heartbeat that defines the planning window**: the **primary
recurring income** anchors the payday cycle (its `dayOfMonth` = the cycle anchor),
and all other income lifts a cycle's picture. This PRD **owns the payday cycle**.

Second consumer of the foundation spine ([RFC 0005](./0005-movement-and-cycle-foundation.md))
after wallets (`0006`). Like wallets it's a **thin follow-on — no new tables, no
migration**: income is a workflow over the existing `RecurringRule` (type
`INCOME`, `isPrimaryIncome`), `Movement` (type `INCOME`), and `Category` (type
`INCOME` = the income **tags**).

**What exists today (spine):**
- `RecurringRule` + `recurring.service` — `createRule` (atomic primary-income
  singleton), `setPrimaryIncome`, `endRule`, `listActiveRules`,
  `getCycleAnchorDay` (primary's `dayOfMonth`, else `1` → calendar months),
  `findPrimaryIncome`, `toProjectionRule`, `projectOccurrences`.
- `Movement` + `movements.service` — `createMovement`, `confirmMovement` (PLANNED
  → ACTUAL). `movements.repository.listByUserInWindow(userId, start, end)`.
- `lib/cycle.ts` — `getCurrentCycle`/`getCycleByOffset`, `occurrenceDateInCycle`,
  `toCycleDate`. `Category` (INCOME) via `categories.service.listCategories`.
- `wallets.service.listWallets` (destination-wallet picker).

### Locked decisions (from PRD 006)

- **One primary recurring income** anchors the cycle; editing its day recomputes
  current + future cycles (never the past — inherent to the data-driven model).
- **Other income**: one-off OR secondary recurring, in the current **or a future**
  cycle, each with a **tag**. Forward income feeds the multi-cycle view (`0009`).
- Income has two states (shared model): **expected/PLANNED** vs
  **received/ACTUAL**; confirmed via **in-app one-tap** (amount defaults to
  planned). On receipt it lands in the wallet balance.
- **Tags** = a managed, user-extendable list → reuse INCOME `Category`s.
- **No primary income yet** → cycle falls back to the calendar month, with a nudge.
- Recurrence is **monthly only** (MVP).

## 2. Design

New **orchestration** feature `src/features/income/` — it composes
`recurring` + `movements` + `cycle` + `categories`/`wallets`. It owns **no table**,
so it has **no `repository.ts`**; all data access goes through the owning modules'
repositories (the layering rule holds: Prisma stays in those repositories).

### Data model & one spine extension

No income tables. **One small addition to the `recurring` module** (the owner of
`RecurringRule`), needed to *edit* a recurring income in place:

- `recurring.repository.update(id, userId, data)` — `updateMany` of
  `amount/dayOfMonth/walletId/categoryId/note` (scoped by `userId`).
- `recurring.service.updateRule(id, userId, input)` — wraps it; `count === 0` →
  `DomainError`.

> **Why update-in-place for the primary income** (not end-old + create-new):
> changing the anchor `dayOfMonth` is *meant* to move every cycle boundary ("change
> the date, the cycle follows" — the data-driven model), and there are no
> materialized past rows to preserve for the anchor. Ending + recreating would
> leave the old rule lingering as a phantom **secondary** income. Update-in-place
> is correct and simplest. (RFC 0005 updated to list the new functions.)

### Layer flow

**`income.service`** (composition; no Prisma):

| Function | Does |
|---|---|
| `getCycleWindow(userId, offset?)` | `anchorDay = recurring.getCycleAnchorDay`; returns `{ cycle: getCycleByOffset(anchorDay, today, offset), hasPrimaryIncome }`. |
| `setPrimaryIncome(userId, input)` | If a primary income rule exists → `recurring.updateRule` (in place); else `recurring.createRule({…, type: INCOME, isPrimaryIncome: true, startsOn: toCycleDate(now)})`. `dayOfMonth` constrained **1–28** (Zod). |
| `addRecurringIncome(userId, input)` | `recurring.createRule({…, type: INCOME, isPrimaryIncome: false, startsOn: toCycleDate(now)})`. `dayOfMonth` 1–31 (only the anchor shortens cycles). |
| `updateRecurringIncome` / `endRecurringIncome` | `recurring.updateRule` / `recurring.endRule` (future-only stop). |
| `addOneOffIncome(userId, input)` | `movements.createMovement({ type: INCOME, status: input.received ? ACTUAL : PLANNED, amount, walletId, categoryId, occurredAt: now, effectiveDate: toCycleDate(input.date), confirmedAt: received ? now : null, note })`. |
| `updateIncome(userId, input)` / `deleteIncome(userId, movementId)` | Edit/delete a **one-off, not-yet-received** income movement (amount/category/note/date). Guard `editableOneOff`: INCOME, `recurringRuleId === null`, **`status === PLANNED`** (once received/ACTUAL it's locked; recurring occurrences are managed via their rule) → `movements.updateMovement` / `movements.deleteMovement`. |
| `confirmIncome(userId, movementId, overrides?)` | One-off PLANNED → ACTUAL via `movements.confirmMovement`; **throws if it flipped nothing** (`count === 0` → already confirmed / not found), so the UI never shows a phantom success. **Cycle guard** (`assertCycleReached`): rejects if the movement's `effectiveDate` is in a **future** cycle (`cycleOf > 0`) — you receive income when its period arrives, not before (else a future-dated ACTUAL wrongly inflates today's balance). |
| `confirmRecurringIncome(userId, ruleId, occurrenceDate, overrides?)` | **Materializes** a projected occurrence: `recurring.repository.findById` → **future-cycle guard** → idempotency guard `movements.repository.findByRuleOnDate(userId, ruleId, effectiveDate)` (reject duplicate) → `movements.createMovement({ type: INCOME, status: ACTUAL, recurringRuleId: ruleId, amount: override ?? rule.amount, walletId, categoryId, occurredAt: now, effectiveDate: toCycleDate(occurrenceDate), confirmedAt: now })`. |
| `listIncome(userId, offset?)` | The income picture for a cycle (below). |

**`listIncome`** composition (the read model):
1. `anchorDay` → `cycle = getCycleByOffset(…, offset)`.
2. `movements.repository.listByUserInWindow(userId, cycle.start, cycle.end)` →
   keep `type === INCOME`. Split ACTUAL (received) vs PLANNED (expected one-off).
3. `recurring.listActiveRules` → INCOME rules → `projectOccurrences(rules, cycle,
   materializedRuleIds)` where `materializedRuleIds` = `recurringRuleId`s of the
   window's INCOME movements (no double-count).
4. Return `{ cycle, hasPrimaryIncome, primary, recurringSources, items }` where
   `items` = received + expected one-offs + projected occurrences, each tagged
   `kind: "received" | "expected" | "projected"` and carrying what `confirm…`
   needs (movementId for expected; ruleId+effectiveDate for projected).

**`income.actions`** (thin `requireUser` + Zod + `runAction`): `setPrimaryIncomeAction`,
`addRecurringIncomeAction`, `updateRecurringIncomeAction`, `endRecurringIncomeAction`,
`addOneOffIncomeAction`, `updateIncomeAction`, `deleteIncomeAction`,
`confirmIncomeAction`, `confirmRecurringIncomeAction`. All
`revalidatePath("/income")` **and** `revalidatePath("/")` (home reads income).

### Server Actions / API — Zod (`schema.ts`)

```ts
amountField   = z.coerce.number().finite().positive("Jumlah harus lebih dari 0")
dayOfMonth    = z.coerce.number().int()
primaryIncomeSchema   = { amount: amountField, dayOfMonth: dayOfMonth.min(1).max(28), walletId, categoryId?, note? }
recurringIncomeSchema = { amount: amountField, dayOfMonth: dayOfMonth.min(1).max(31), walletId, categoryId?, note? }
oneOffIncomeSchema    = { amount: amountField, date: z.coerce.date(), walletId, categoryId?, note?, received: z.boolean().default(false) }
updateIncomeSchema    = { movementId, amount: amountField, date: z.coerce.date(), categoryId?, note? }
confirmIncomeSchema   = { movementId, amount?: amountField, walletId?, date?: z.coerce.date() }
```

`dayOfMonth.max(28)` for the **primary** income is the mitigation for the
end-of-month-anchor risk in RFC 0005 (anchors ≤ 28 keep every cycle clean).

### UI

- **Route `/income`** (nav **"Pemasukan"**). Server component fetches
  `listIncome(userId, offset)`, the INCOME `Category`s (tags) and active wallets,
  maps to DTOs, renders `<IncomeManager>`.
- **`IncomeManager`** (client; same idiom as `WalletManager` — RHF + Zod, dialogs,
  `sonner`, `useTransition`):
  - **Cycle banner** — `cycle.label` ("25 Mei – 24 Jun"); if `!hasPrimaryIncome`, a
    nudge card "Atur gaji utama" (so the cycle is meaningful).
  - **Primary income** card — amount + day + wallet + tag; set/edit dialog.
  - **Other sources** — secondary recurring rules (edit/stop) + an "Tambah
    pemasukan" dialog (one-off or recurring; received-now toggle; date for forward).
  - **This cycle's income** list — received / expected / projected, with **one-tap
    confirm** ("Terima") on expected + projected (amount defaults to planned).
    **One-off** rows (`movementId && !ruleId`) also get per-row **edit + delete**
    (dedicated edit dialog: amount/date/tag/note).
  - States: loading (`pending`), empty, error (toast from `DomainError`).
- Amount + date fields use the shared `<CurrencyInput>` (Rp + id-ID grouping) and
  `<DatePicker>` (styled calendar) from Batch B, replacing native number/date inputs.
- Tag picker = INCOME categories with a "＋ kelola" link to `/categories`.

The full X→Y→Z home + cycle switcher remain `0009`; `0007` ships income management
+ this-cycle income + confirm, plus the now-real cycle window.

## 3. Alternatives considered

- **End-old + create-new on primary edit** — pollutes with ended rules and risks a
  phantom secondary income; rejected for update-in-place (see Design note).
- **A dedicated `income` table** — rejected; income is fully expressed by
  `RecurringRule` + `Movement`. A new table would duplicate the spine.
- **Confirm a projection by pre-creating PLANNED rows for future cycles** — that's
  the materialize-everything approach RFC 0005 rejected; we keep compute-on-read +
  materialize-on-confirm (a projected occurrence becomes a row only when received).
- **Free-text income tags** — rejected; reuse INCOME `Category`s so tags are a
  managed, deduplicated, user-extendable list (PRD 006).

## 4. Risks & trade-offs

- **End-of-month anchor.** Primary `dayOfMonth` constrained **1–28** in Zod
  (the RFC 0005 mitigation); secondary income / obligations may use 1–31.
- **Double-count projected vs materialized.** `listIncome` builds
  `materializedRuleIds` from the *window's* INCOME movements, so a confirmed
  recurring income is never also shown as a projection. Covered by a service test.
- **Editing the primary anchor shifts cycle boundaries** for current + future
  cycles — intended (data-driven cycle). Past cycles aren't shown in MVP, so no
  surprise. Documented.
- **Concurrency of the singleton** (one primary income) — service + transaction in
  `recurring`, same as wallets; fine for a single-user-per-account app.
- **Cleared amount input.** `amountField` is `.positive()`, and the action maps
  empty → `undefined` (`|| undefined`) → Zod error, so a blank can't post a 0.
- **Money.** Amounts `Decimal` in DB, `Number()` at the boundary, `roundMoney` in
  derivations. **Security.** Every query scoped by `userId`; actions `requireUser`.
- **No migration** beyond the additive `recurring.update` code path → no
  destructive risk.

## 5. Test plan

**Unit (service, dependencies mocked via `vi.mock` on `recurring`/`movements`):**

- `setPrimaryIncome`: creates when none exists; **updates in place** when one does
  (no second primary created).
- `addOneOffIncome`: `received` → ACTUAL with `confirmedAt`; else PLANNED with
  `confirmedAt: null`; `effectiveDate` normalized via `toCycleDate`.
- `confirmIncome`: PLANNED one-off → `movements.confirmMovement`; **rejects a
  future-cycle item** (allows current/past).
- `confirmRecurringIncome`: materializes an ACTUAL INCOME movement carrying
  `recurringRuleId` and the rule's amount (or an override); **rejects a future-cycle
  occurrence**.
- `updateIncome` / `deleteIncome`: edit/delete a one-off **expected (PLANNED)**;
  **reject** a recurring-materialized movement and a **received (ACTUAL)** one.
- `listIncome`: splits received/expected; projects active INCOME rules; **excludes
  a rule already materialized in the window** (no double-count).
- `getCycleWindow`: uses the primary anchor; falls back to calendar month when none.

**Manual:** set salary (day 25) → cycle shows "25 … – 24 …"; add a forward side-gig
income next cycle → appears as expected; confirm it → lands ACTUAL in the wallet and
lifts that wallet's balance; edit the salary day → cycle window shifts.

## 6. Rollout

1. No migration. Add `recurring.repository.update` + `recurring.service.updateRule`
   (update RFC 0005's function list).
2. Add `src/features/income/` (service, schema, types, mapper, actions,
   `components/income-manager.tsx`, `__tests__/`).
3. Add route `src/app/(app)/income/page.tsx` + **Pemasukan** nav item.
4. `bun run test` · `type-check` · `lint` · `build` green; `/simplify` +
   `/code-review` on the diff.
5. Back-out: delete the income module + route + nav + the two `recurring` functions.

## 7. Implementation checklist

- [x] `recurring.repository.update` + `recurring.service.updateRule` (RFC 0005 synced)
      + `recurring` service tests (4)
- [x] `movements.repository.findByRuleOnDate` (confirm idempotency guard; RFC 0005 synced)
- [x] `income/schema.ts` (base-composed) + `types.ts` + `mapper.ts`
- [x] `income/service.ts` (cycle window, primary upsert, recurring/one-off add,
      confirm w/ count-guard, materialize w/ dup-guard, `listIncome`) + tests (11)
- [x] `income/actions.ts` (thin; revalidate `/income` + `/`)
- [x] `income/components/income-manager.tsx` (controlled-state forms — see note)
- [x] Route `app/(app)/income/page.tsx` + **Pemasukan** nav item
- [x] `bun run test` (98) · `type-check` · `lint` · `build` clean
- [x] `/simplify` + `/code-review` run — applied: confirm-flow guards
      (count-check + materialize idempotency), UTC→local date default, schema DRY
- [x] This RFC updated to match final code; `last_verified` set; status → `Implemented`

> **Implementation notes (review-applied):**
> - The form uses **controlled state** rather than react-hook-form (a deliberate
>   divergence from `WalletManager`): three dialogs over different schemas would
>   each need their own resolver + `z.coerce` cast; controlled inputs + server-side
>   Zod is simpler here, with errors surfaced via toast.
> - **Confirm idempotency**: `confirmIncome` rejects a no-op flip; `confirmRecurringIncome`
>   rejects a duplicate (a movement already on that rule+date) — so a double-tap
>   can't create two ACTUAL income rows.
> - **Polish (2026-06-07):** the cycle income list now shows the item's **note** in
>   the subtitle (appended after the tag) so same-tag items are distinguishable;
>   `noteField` cap lowered **120 → 50** chars.
