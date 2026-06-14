# Polish backlog (UI/UX nits)

> Running list of UI/UX tweaks found during smoke-testing the MVP. **Not bugs**
> (the app works) — these are visual/interaction polish to batch later, after the
> MVP is reviewed/committed. Sony drops items here; we knock them out in one pass.

## Open

_(empty — all MVP polish items shipped; see Done below.)_

## Post-MVP (deferred — after v0.1 ships; Sony's call 2026-06-14)

| # | Where | Want | Note |
|---|---|---|---|
| 7 | `/expenses` page | A **cycle spending summary** on the page — total pengeluaran (and likely the X→Y→Z mini-recap) for the selected cycle — so you don't bounce back to Beranda to see "berapa total pengeluaran siklus ini" while recording. | Expenses page currently only lists items + recurring rules; no totals. Could reuse `home`'s forecast or add a lightweight per-cycle total in `listExpenses`. |
| 8 | `/expenses` page | **UX / empty-state polish** — the page feels bare/empty and the hierarchy is weak. Improve layout, empty states, and visual rhythm (esp. when few items). | General redesign pass; pairs with #7. |

## Done

**Batch B + C (2026-06-14).** Gate green (141 tests · type-check · lint · build);
independent code-review pass (no material findings); RFCs `0007`/`0008`/`0009` synced.

> **Bug found in smoke-test + fixed (2026-06-14):** future-dated movements wrongly hit
> *today's* balance because `deriveBalance` sums all ACTUAL regardless of date. Two
> entry points, both closed:
> 1. **Confirm path** — pressing **Bayar** on an obligation in a *future* cycle (now
>    reachable via the `/expenses` switcher) flipped it ACTUAL early → negative
>    "safe to spend". Fix: **future-cycle guard** `assertCycleReached` (`cycleOf > 0`
>    → reject) in all 4 confirm services, plus the `/expenses` "Bayar" hidden on
>    future cycles (shows **"Terjadwal"**).
> 2. **Record path** — recording a *cash* expense with a future date + "sudah dibayar"
>    on. Fix: `recordExpense` force-PLANNs a future-cycle cash expense regardless of
>    the toggle.
>
> **Data repaired:** the two wrongly-confirmed recurring "Ortu" Rp2.5jt occurrences
> (eff 25 Jun) were deleted (they re-project as "Terjadwal"); pooled balance restored
> −Rp3.720.000 → +Rp1.280.000.

> **Recurring note now shows on occurrences (2026-06-14):** a recurring obligation/
> income rule's **note** is now carried through projection (`ProjectionRule` →
> `ProjectedOccurrence` → cycle lists + home), so two same-tag recurring items (e.g.
> "Buat Bunda" vs "Buat Ayah") are distinguishable; the note also shows on the
> "Tagihan rutin" / "Pemasukan rutin" rule rows. (Batch A had dropped the note on
> projections — reversed.)

> **Per-occurrence recurring management + lock-paid (2026-06-14):** from `/expenses`,
> a scheduled **recurring** obligation occurrence can now be **adjusted** (override
> this cycle's amount) or **skipped** (this cycle only — rule keeps running; muted
> "Dilewati" row with **Pulihkan**/restore), keyed by (rule, occurrenceDate) via
> materialization. Needed a new **`SKIPPED` `MovementStatus`** (additive migration
> `add_skipped_movement_status`) — never counted in balance or Y, restorable by
> deleting the marker. **Lock-paid:** edit/delete (expense + income) now require the
> item to still be **PLANNED**; once **paid/received (ACTUAL)** it's locked. This was
> the deferred Phase-1 "skip/adjust one occurrence". Gate green (**153 tests**); RFCs
> `0005`/`0007`/`0008`/`0009` synced.

> **`CurrencyInput` digit cap fixed (2026-06-14):** amounts couldn't exceed ~5 digits
> — `toDigits` split the *typed* string on `.`, but id-ID grouping uses `.` as the
> thousands separator, so once "2.222" appeared the next keystroke collapsed it to "2".
> Fix: split the helpers — `typedDigits` (strip ALL non-digits, for the grouped field
> string) vs `toDigits` (integer part of the numeric `value` prop, decimal-aware).
> Extracted to `components/ui/currency-format.ts` with unit tests. Affected every amount
> field (income/expense/obligation/wallet). Suite now **145 tests**.

| # | Where | Fix shipped |
|---|---|---|
| 2 | All amount inputs | New reusable **`<CurrencyInput>`** (`components/ui/currency-input.tsx`): `Rp` prefix + live id-ID dot-grouping (`Rp 1.000.000`), stores/submits the raw digit string, `inputMode="numeric"`, no spinner, caret preserved on re-group. Swapped into income amount, expense amount, recurring obligation amount, wallet starting balance + adjust target. |
| 1 | Income + Expense date fields | New styled **`<DatePicker>`** (`components/ui/date-picker.tsx`): Radix Popover + a date-fns month grid (id locale, Monday-start), reads/writes the same `"YYYY-MM-DD"` string as a local date (no TZ shift). Replaces native `type="date"` on one-off income date, expense tx date, expense due date. (New `components/ui/popover.tsx` wrapper.) |
| 3a | `/expenses` — other cycles | **`<CycleSwitcher>`** extracted to `components/cycle-switcher.tsx` (was inline in home) and reused on `/expenses` (`?offset` searchParam → `listExpenses(offset)`; service now returns a `strip`). Home refactored to the shared component. |
| 3b | `/expenses` + `/income` — edit/delete | Per-row **edit + delete** on one-off movements (`movementId && !ruleId`). New `movements.repository.update` + `movements.updateMovement` spine primitive; `expenses.updateExpense`/`deleteExpense` + `income.updateIncome`/`deleteIncome` with an `EXPENSE/INCOME` + `recurringRuleId === null` guard; matching actions + edit dialogs. This unblocks deleting the stuck `-Rp624.000` cash entry. |
| 6 | Expense capture — planned cash | **"Sudah dibayar" toggle** (cash only; default on). Unchecking records a **PLANNED** cash expense on its date (lands in that cycle's Y "Bakal keluar", deducts only on confirm "Bayar") instead of an ACTUAL that wrongly drops today's balance. `expenseSchema.paid` + `recordExpense` (`paid === false ? PLANNED : ACTUAL`); no `deriveBalance` change. |

**Batch A — notes (2026-06-07).** TDD/verify gate green (125 tests · type-check · lint · build), RFCs `0007`/`0008`/`0009` synced.

| # | Where | Fix shipped |
|---|---|---|
| 4 | Home "Jatuh tempo" + "Perlu konfirmasi", expenses list, income list | The item **note** is now appended to the subtitle (after the tag) so same-tag items are distinguishable. Threaded `note` through `ForecastEvent → ForecastItemDTO → mapper → HomeView`; projected occurrences carry no note (mirrors `expenses.listExpenses`). |
| 5 | `noteField` cap | Lowered **120 → 50** chars in `income/schema.ts`, `expenses/schema.ts`, and the wallet adjust note (`wallets/schema.ts`). |
