---
id: "0008"
title: "Expenses & obligations"
status: Implemented # Draft → Approved → In Progress → Implemented
prd: # docs/prd/mvp/007-expenses-and-obligations.md
author: Engineering
created: 2026-06-06
last_updated: 2026-06-15
last_verified: 2026-06-15 # matches code (156 tests green; + /expenses cycle spending summary (summarizeExpenseItems) + Z recap via home.getCycleForecast + friendly empty states, polish #7/#8)
---

# RFC 0008 — Expenses & obligations

> **Accuracy rule:** this RFC must match what's in the code. If the
> implementation changes, update this document in the same change.

## 1. Context

Implements [`007` Expenses & obligations](../prd/mvp/007-expenses-and-obligations.md).
The core insight: **payment method decides timing.** Cash hits the wallet now;
**credit-card / paylater / recurring** create **obligations** that hit the paying
wallet on their **due date** — landing in the cycle the due date falls in. Getting
this right is what stops the mid-cycle surprise. Obligations due in a cycle roll
up into **Y "bakal keluar"** (computed in `0009`).

Third spine consumer ([RFC 0005](./0005-movement-and-cycle-foundation.md)). Two new
feature modules; **no new tables** — `Card`, `Movement` (EXPENSE), `RecurringRule`
(type EXPENSE), and `Category` (EXPENSE) all exist from `0005`. (One additive
migration was added later: a `SKIPPED` `MovementStatus` for per-occurrence skip —
see §2 "Per-occurrence overrides".)

**Spine reused:** `movements.resolveTiming(method, occurredAt, dueDate)` (cash →
ACTUAL now / CC·paylater → PLANNED on due date), `movements.createMovement`,
`confirmMovement`, `repository.listByUserInWindow`, `findByRuleOnDate` (confirm
idempotency, added in `0007`); `recurring.{createRule,updateRule,endRule,
listActiveRules}` + `projection`; `cycle.{getCycleByOffset,cycleOf,toCycleDate}`;
`wallets`/`categories` for pickers.

### Locked decisions (from PRD 007)

- **CC billing — middle path:** a `Card` has a `defaultDueDay` + `payingWallet`;
  each CC/paylater purchase becomes an obligation whose due date **inherits from
  the card** (editable per purchase). The home **groups by card** (`0009`).
  Statement-closing logic deferred.
- **Pay-from wallet on confirm:** defaults to the card/rule's paying wallet,
  editable at confirm.
- **Recurring obligation** (cicilan, SPP): monthly; editing applies to the future
  only; a single occurrence can be skipped/adjusted without changing the rule.
- **Confirm paid** = one-tap (mirrors income); on confirm it's an ACTUAL movement
  deducting the paying wallet.
- **Live impact preview** while entering (which cycle it hits).

## 2. Design

Two modules:

- **`src/features/cards/`** — owns the `Card` table → has a `repository.ts`
  (the only Prisma here). CRUD for CC/paylater paying instruments.
- **`src/features/expenses/`** — **orchestration** over `movements` + `cards` +
  `recurring` + `cycle` (owns no table → no `repository.ts`).

### Cards — layer flow

`cards.repository` (Prisma): `listActive`, `findById`, `create`, `update`,
`archive`/`restore`, `remove`, `countByUser`.
`cards.service`: `listCards`, `createCard`, `updateCard`, `removeCard`
(fresh → delete; in use by a movement / recurring rule → **P2003 fallback to
archive**, exactly like wallets). `cards.actions` (thin). A card references a
paying wallet (`payingWalletId`, FK `Restrict` — a wallet paying a card can't be
hard-deleted, which wallets already handles by archiving).

### Expense timing — pure helper (tested)

```ts
// expenses/timing.ts  (pure, no I/O)
// The next occurrence of `dueDay` on or after `from` (Jakarta calendar, clamped
// to month length). e.g. nextDueDate(3, 5 Jun) → 3 Jul; nextDueDate(20, 5 Jun) → 20 Jun.
nextDueDate(dueDay: number, from: Date): Date
```

### Expenses — layer flow (`expenses.service`, composition; no Prisma)

| Function | Does |
|---|---|
| `recordExpense(userId, input)` | **cash** → ACTUAL on the tx date (deducts now), `walletId = input.walletId`. PLANNED instead (sits in that cycle's Y, deducts only on confirm) when **either** `input.paid === false` (the **"belum dibayar / rencana"** toggle, polish #6) **or** the date is in a **future cycle** (`cycleOf > 0`) — you can't have already-paid cash for a cycle that hasn't started, and a future-dated ACTUAL would wrongly cut today's balance. **CC/paylater** → `card = cards.repository.findById`; `dueDate = input.dueDate ?? nextDueDate(card.defaultDueDay, txDate)`; `resolveTiming(method, txDate, dueDate)` → PLANNED; `walletId = card.payingWalletId`, `cardId = card.id`. Then `createMovement({ type: EXPENSE, status, amount, walletId, cardId, categoryId, paymentMethod, occurredAt: txDate, effectiveDate: toCycleDate(date), note })`. |
| `addRecurringObligation(userId, input)` | `recurring.createRule({ type: EXPENSE, amount, dayOfMonth, walletId, cardId?, categoryId?, startsOn: toCycleDate(now) })`. |
| `updateRecurringObligation` / `endRecurringObligation` | `recurring.updateRule` / `endRule` (future-only). |
| `confirmObligation(userId, movementId, overrides?)` | PLANNED → ACTUAL via `confirmMovement`; **throws on `count === 0`** (already paid / not found). `walletId`/`amount`/`date` overridable. (Also confirms a planned cash expense — same one-tap "Bayar".) **Cycle guard** (`assertCycleReached`): rejects if the movement's `effectiveDate` is in a **future** cycle (`cycleOf(anchorDay, now, …) > 0`) — you can't pay before its period arrives. |
| `confirmRecurringObligation(userId, ruleId, occurrenceDate, overrides?)` | **Materialize** with the `findByRuleOnDate` dup-guard (as income): ACTUAL EXPENSE, `walletId = override ?? rule.walletId`, `cardId = rule.cardId`, `recurringRuleId`. The **amount override covers "adjust one occurrence"** (e.g. SPP partial). Same **future-cycle guard** as `confirmObligation`. |
| `updateExpense(userId, input)` | Edit a **one-off, not-yet-paid** expense movement (amount/category/note/date; the date doubles as a card obligation's due date). Guard `editableOneOff`: EXPENSE, `recurringRuleId === null`, **`status === PLANNED`** (once ACTUAL it's locked; recurring is managed by the occurrence helpers). Then `movements.updateMovement`. |
| `deleteExpense(userId, movementId)` | Delete a one-off, not-yet-paid expense movement (same `editableOneOff` guard) → `movements.deleteMovement`. |
| `adjustObligationOccurrence(userId, {ruleId, occurrenceDate, amount})` | **Per-occurrence amount override** (this cycle only). `loadOccurrence` finds-or-creates a `Movement` for (rule, date): if one exists (and isn't ACTUAL) → `updateMovement` to `{amount, status: PLANNED}`; else `createMovement` PLANNED from the rule. Materializing suppresses that cycle's projection. |
| `skipObligationOccurrence(userId, {ruleId, occurrenceDate})` | **Skip this cycle's occurrence** — materialize/flip the (rule, date) movement to **`SKIPPED`** (drops out of Y, never hits balance; the rule keeps running next cycle). |
| `restoreObligationOccurrence(userId, {ruleId, occurrenceDate})` | **Undo** an adjust/skip — delete the (rule, date) marker so the default projection returns. |
| `listExpenses(userId, offset?)` | This cycle's expenses + obligations (actual cash → `paid`, planned → `due`, `SKIPPED` → `skipped`, projected recurring EXPENSE minus materialized), plus the active recurring obligations + cards for the UI, **plus a `strip` of current + 12 forward cycles** for the switcher, **plus a `summary`** (see below). Same compose-on-read shape as `listIncome`. |
| `summarizeExpenseItems(items)` | **Pure** roll-up of the cycle's items into headline totals: `{ spent, upcoming, total, count }` — `paid` → `spent` (already out, ACTUAL), `due` + `projected` → `upcoming` (still due, equals the home's Y), `skipped` excluded. Derived from the **same `items`** the page lists, so the headline always equals the sum of the rows. Returned by `listExpenses` as `view.summary`. |

> **Per-occurrence overrides (was deferred; shipped 2026-06-14).** A recurring
> obligation can be **adjusted or skipped for a single cycle** without touching the
> rule. Both work by **materializing** a `Movement` for (rule, occurrenceDate) —
> which `materializedRuleIds` already excludes from projection — so an occurrence is
> one of: projected (no row, default), PLANNED (adjusted, payable), `SKIPPED`
> (dropped this cycle, restorable), or ACTUAL (paid, locked). `loadOccurrence`
> rejects any change once it's ACTUAL. **Skip needs the new `SKIPPED`
> `MovementStatus`** (additive migration `add_skipped_movement_status`): it's never
> `=== ACTUAL` so `deriveBalance` ignores it, and the home's `planned` filter
> (`status === PLANNED`) keeps it out of Y. These are **not** cycle-guarded
> (planning a future cycle is fine); only *paying* is.

`expenses.actions` (thin `requireUser` + Zod + `runAction`): `recordExpenseAction`,
`updateExpenseAction`, `deleteExpenseAction`, `adjustObligationOccurrenceAction`,
`skipObligationOccurrenceAction`, `restoreObligationOccurrenceAction`,
`addRecurringObligationAction`, `updateRecurringObligationAction`,
`endRecurringObligationAction`, `confirmObligationAction`,
`confirmRecurringObligationAction`. All `revalidatePath("/expenses")` **and**
`revalidatePath("/")`.

> **Spine extension (RFC 0005).** Editing a one-off needed a generic mutate
> primitive: `movements.repository.update(id, userId, { amount?, categoryId?,
> note?, effectiveDate?, status?, confirmedAt? })` (scoped `updateMany`) wrapped by
> `movements.updateMovement`. `deleteMovement` already existed. Both income
> (`0007`) and expenses reuse them behind their own ownership guards; the
> per-occurrence helpers use the `status` field to flip PLANNED ↔ SKIPPED.

### Server Actions / API — Zod (`schema.ts`)

```ts
paymentMethodSchema = z.enum([CASH, CREDIT_CARD, PAYLATER])
expenseSchema = {
  amount: amountField,            // positive
  date: z.coerce.date(),          // transaction date
  method: paymentMethodSchema,
  walletId: z.string().optional(),  // required for CASH (refine)
  cardId: z.string().optional(),    // required for CC/PAYLATER (refine)
  dueDate: z.coerce.date().optional(),  // CC/paylater; defaults from card
  categoryId: z.string().optional(),
  note: noteField,
  paid: z.boolean().optional(),   // cash only; false → PLANNED (rencana). absent → paid now
}.refine(cash⇒walletId, ccPaylater⇒cardId)
updateExpenseSchema = { movementId, amount, date, categoryId?, note? }   // edit a one-off
adjustOccurrenceSchema = { ruleId, occurrenceDate, amount }              // per-cycle override
occurrenceSchema       = { ruleId, occurrenceDate }                      // skip / restore
recurringObligationSchema = { amount, dayOfMonth(1–31), walletId, cardId?, categoryId?, note? }
cardSchema = { name, kind: z.enum([CREDIT_CARD, PAYLATER]), defaultDueDay(1–31), payingWalletId }
```

### UI

- **Route `/expenses`** (nav **"Pengeluaran"**). Server component reads `?offset`
  (clamped 0…12), fetches `listExpenses(offset)`, EXPENSE categories, and the
  cycle `anchorDay`; renders `<ExpenseManager>`. It **also calls
  `home.getCycleForecast(offset)`** for the same cycle — reusing its `forecast`
  (the `z` "aman dipakai" recap, identical to Beranda — single source of truth, no
  drift) **and** the `wallets` it already returns (so no second `listWallets` pass).
- **`ExpenseManager`** (client; controlled-state forms like `IncomeManager`):
  - **Spending summary card** (polish #7) — the page's focal point: cycle label +
    `<CycleSwitcher>`, then **Total pengeluaran** (`summary.total`) with a
    **Sudah keluar** (`summary.spent`) / **Bakal keluar** (`summary.upcoming`) split,
    and a tappable **"Aman dipakai «Z»"** recap (links to Beranda) so you don't bounce
    while recording. Totals come from the same items listed below.
  - **Cycle banner + `<CycleSwitcher>`** — the same shared dropdown-pill the home
    uses (`src/components/cycle-switcher.tsx`), linking to `/expenses?offset=N`, so
    future cycles' items are viewable/manageable. (Folded into the summary card's header.)
  - **Capture dialog** (the mockup's "Catat cepat" expense side): amount
    (`<CurrencyInput>`) → method chips (Cash/Kartu Kredit/Paylater) → source (wallet
    for cash, card for CC/paylater) → **due date** (CC/paylater `<DatePicker>`,
    default `nextDueDate`) → category → tx date (`<DatePicker>`) → note → **"sudah
    dibayar" toggle** (cash only; unchecking plans it, polish #6) → **live impact
    preview**. The preview is computed **client-side** with `lib/cycle` (pure,
    import-safe): cash paid → "langsung motong (cycle X)"; cash planned → "belum
    motong, masuk bakal keluar"; CC/paylater → "nampar di siklus «label»". `anchorDay`
    comes from the server.
  - **Kartu (cards)** section — list + add/edit (name, kind, due day, paying wallet).
  - **Pengeluaran rutin** section — recurring obligations (add/edit/stop).
  - **Pengeluaran & tagihan siklus ini** — actual + obligations. **"Bayar"** (confirm)
    shows on pending rows **only when viewing the current cycle** (`view.cycle.isCurrent`);
    on a **future** cycle the row shows a muted **"Terjadwal"** badge (you pay when its
    period arrives — the server enforces the same via the cycle guard). Per-row **edit +
    delete** on pending rows (any cycle — you can adjust a plan): a **one-off** (`!ruleId`)
    → edit the movement / delete it; a **recurring occurrence** (`ruleId`) → **adjust**
    its amount for this cycle / **skip** it this cycle (`Trash2`, "Lewati"). A **skipped**
    row renders muted ("Dilewati") with a **Pulihkan** (restore) action. A **paid** row is
    **locked** (no actions). The edit dialog adapts: one-off shows amount/date/category/
    note; occurrence-adjust shows amount only (date/tag come from the rule).
- Inputs use the shared `<CurrencyInput>` (Rp + id-ID grouping) and `<DatePicker>`
  (styled calendar) from Batch B, replacing native number/date inputs.
- Category picker = EXPENSE categories (＋ kelola → `/categories`).
- **Empty states** (polish #8) — each of the three sections (items, recurring
  obligations, cards) renders a friendly local `EmptyState` (icon + message +
  inline add action) when empty, instead of a bare line / nothing, so a fresh or
  sparse cycle no longer looks hollow. The items empty state adapts its copy for a
  future/projected cycle (no "catat" action there).

The per-card **Y grouping** + the home's obligations roll-up is `0009`; `0008`
ships capture, cards, recurring obligations, and this-cycle list + confirm.

## 3. Alternatives considered

- **CC statement-closing logic** (which purchases fall in which statement cycle) —
  deferred (PRD): middle-path due-day inheritance is enough for a trustworthy Y.
- **A dedicated obligations table** — rejected; an obligation is a PLANNED
  `Movement` (cash/CC/paylater) or a projected `RecurringRule` occurrence.
- **Server-rendered impact preview** (round-trip per keystroke) — rejected; the
  cycle math is pure and runs client-side instantly from `anchorDay`.
- **Skip = a linked `amount: 0` ACTUAL marker** — rejected (would show as a Rp0 paid
  row + leak into balance math). **Chosen:** a dedicated `SKIPPED` `MovementStatus` —
  explicit, never counted in balance or Y, and trivially restorable by deleting it.

## 4. Risks & trade-offs

- **Due-date defaulting.** `nextDueDate` clamps to month length and rolls to next
  month when the day already passed; unit-tested at boundaries (Feb, day 29–31,
  on/after `from`).
- **Confirm idempotency.** Reuses the `0007` guards: `confirmObligation` rejects a
  no-op flip; `confirmRecurringObligation` rejects a duplicate via `findByRuleOnDate`
  — a double-tap can't create two ACTUAL expense rows.
- **Per-occurrence overrides & `SKIPPED`.** Adjust/skip materialize a (rule, date)
  movement, which `materializedRuleIds` excludes from projection — so no duplicate
  row. `SKIPPED` is never `=== ACTUAL` (ignored by `deriveBalance`) and not `PLANNED`
  (kept out of the home's Y), so a skipped occurrence simply vanishes from forecasts;
  restoring = deleting the marker. ACTUAL occurrences are locked against override.
- **Impact preview correctness.** Client uses the *same* pure `cycle` module as the
  server, so the preview and the persisted cycle assignment can't disagree;
  `effectiveDate` is normalized via `toCycleDate` on write.
- **Planned cash expense (polish #6).** `deriveBalance` sums *all* ACTUAL movements
  regardless of date, so a future-dated *cash* expense recorded as ACTUAL would
  wrongly drop today's balance. The "belum dibayar / rencana" toggle records it
  **PLANNED** instead — so it lands in the cycle's Y and only deducts when confirmed
  via `confirmObligation`. This is the principled fix (vs. abusing CC/paylater or a
  manual balance adjustment); it needs no `deriveBalance` change. **`recordExpense`
  also force-PLANNs a future-cycle cash expense even if "sudah dibayar" is left on**
  (closing the same loophole on the *create* path, symmetric with the confirm guard).
- **Edit/delete scope.** Only one-off movements (`recurringRuleId === null`) are
  editable/deletable through `updateExpense`/`deleteExpense`; recurring occurrences
  are managed via their rule. Guard is server-side (service `findById` + the
  `updateMany`/`deleteMany` `userId` scope) **and** in the UI (rows show the controls
  only when `movementId && !ruleId`).
- **Future-cycle confirm guard (bug fix 2026-06-14).** `deriveBalance` sums all
  ACTUAL regardless of date, so confirming an obligation whose `effectiveDate` is in
  a *future* cycle would flip it to ACTUAL and immediately cut **today's** balance
  (observed: paying next cycle's bills made the current "safe to spend" go negative).
  Fix: `assertCycleReached` rejects confirming any item whose cycle offset is `> 0`
  (current/past only) — in **both** confirm services — plus the `/expenses` "Bayar"
  button is hidden on future cycles. You pay a bill when its period arrives. (The
  deeper option — making `deriveBalance`/X date-aware — was deferred; the cycle guard
  matches the home's existing current-cycle-only confirm and is lower-risk.)
- **Card delete guard.** A card used by a movement / recurring rule → `Movement.cardId`
  / `RecurringRule.cardId` are `SetNull` (the obligation survives, loses the link),
  so a card *can* be deleted without orphaning history; we still offer archive for
  tidiness and to keep it out of pickers. (Matches the `0005` FK choices.)
- **Money / security / no migration** — as `0006`/`0007`.

## 5. Test plan

**Unit (pure):** `expenses/timing.ts` `nextDueDate` — same month vs next month,
month-length clamp (Feb/30/31), on-or-after boundary.

**Unit (service, deps mocked):**
- `recordExpense`: cash → ACTUAL on tx date, deducts `input.walletId`; **cash +
  `paid: false` → PLANNED** on its date (polish #6); **cash + future-cycle date →
  PLANNED even if paid**; CC/paylater → PLANNED on `nextDueDate` (or override),
  `walletId = card.payingWalletId`, `cardId` set, `effectiveDate` normalized.
- `addRecurringObligation`: EXPENSE rule with the right fields.
- `confirmObligation`: rejects `count === 0`; **rejects a future-cycle item**
  (allows current/past).
- `confirmRecurringObligation`: materializes ACTUAL EXPENSE w/ rule + paying wallet;
  rejects a duplicate (dup-guard); **rejects a future-cycle occurrence**.
- `updateExpense` / `deleteExpense`: edit/delete a one-off **PLANNED**; **reject** a
  recurring-materialized movement, an income movement, and a **paid (ACTUAL)** one.
- `adjustObligationOccurrence` / `skipObligationOccurrence` /
  `restoreObligationOccurrence`: materialize PLANNED override / SKIPPED / delete marker;
  **reject** overriding an already-paid (ACTUAL) occurrence.
- `listExpenses`: actual + planned + projected EXPENSE; excludes materialized rules;
  **a SKIPPED occurrence shows as `skipped` and suppresses its projection**; returns
  a `summary` that rolls the same items up.
- `summarizeExpenseItems` (pure): splits `paid`→`spent` vs `due`/`projected`→`upcoming`,
  excludes `skipped`, totals & counts; all-zero for an empty cycle.
- `cards.service`: create/update; `removeCard` deletes fresh, P2003 → archive.

**Manual:** cash expense drops the wallet now; CC expense (card due day 3, today
5 Jun) → preview says "siklus 25 Jun – 24 Jul", lands PLANNED on 3 Jul; recurring
SPP appears each cycle; confirm an obligation → wallet drops.

## 6. Rollout

1. No migration. Add `src/features/cards/` + `src/features/expenses/`.
2. Route `app/(app)/expenses/page.tsx` + **Pengeluaran** nav item.
3. `bun run test` · `type-check` · `lint` · `build` green; `/simplify` + `/code-review`.
4. Back-out: delete the two modules + route + nav entry.

## 7. Implementation checklist

- [x] `cards/` (repository, service, schema, types, mapper, actions) + tests (5)
- [x] `expenses/timing.ts` (`nextDueDate`, pure) + tests (5)
- [x] `expenses/` (schema, types, mapper, service, actions) + service tests (7)
- [x] `expenses/components/expense-manager.tsx` (capture + client-side impact
      preview + cards section + recurring obligations + this-cycle list/confirm)
- [x] Route `app/(app)/expenses/page.tsx` + **Pengeluaran** nav item
- [x] `bun run test` (117) · `type-check` · `lint` · `build` clean
- [x] `/simplify` + `/code-review` run — cleanup clean; fixed: a materialized
      recurring obligation records `paymentMethod: null` (a scheduled wallet
      debit), not a hardcoded `CREDIT_CARD`
- [x] This RFC updated to match final code; `last_verified` set; status → `Implemented`

> **Implementation notes (review-applied):**
> - `toProjectionRule` was promoted to the pure `recurring/projection.ts` and is
>   now shared by `income` + `expenses` (no duplication).
> - A recurring obligation materializes with `paymentMethod: null` — it's a
>   scheduled debit from its paying wallet; the `cardId` (if any) only links
>   grouping. The card picker for recurring obligations isn't exposed in MVP.
> - **Polish (2026-06-07):** the cycle expense list now shows the item's **note** in
>   the subtitle (appended after the tag) so same-tag items are distinguishable;
>   `noteField` cap lowered **120 → 50** chars.
> - **Polish (2026-06-14):** projected occurrences now **carry the rule's note**
>   (threaded through `ProjectionRule`/`ProjectedOccurrence`), so two same-tag
>   recurring obligations (e.g. "Buat Bunda" vs "Buat Ayah") are distinguishable in
>   the cycle list; the note also shows on the "Tagihan rutin" rule rows. (Earlier the
>   projection dropped the note — reversed.)
