---
id: "0009"
title: "Home — safe to spend"
status: Implemented # Draft → Approved → In Progress → Implemented
prd: # docs/prd/mvp/008-home-safe-to-spend.md
author: Engineering
created: 2026-06-06
last_updated: 2026-06-07
last_verified: 2026-06-14 # implementation matches this doc (153 tests green; switcher extracted; SKIPPED occurrences excluded from Y)
---

# RFC 0009 — Home — safe to spend

> **Accuracy rule:** this RFC must match what's in the code. If the
> implementation changes, update this document in the same change.

## 1. Context

Implements [`008` Home — safe to spend](../prd/mvp/008-home-safe-to-spend.md) —
the product's face. It answers **"how much can I safely spend before my next
paycheck?"** as **Z = X − Y** for the selected cycle, with a **cycle switcher** to
project forward. It **reads** wallets (`0006`), income/cycle (`0007`), expenses/
obligations (`0008`) — it computes and displays, owns no data.

Final spine consumer ([RFC 0005](./0005-movement-and-cycle-foundation.md)); it
realizes the `CycleForecast` contract sketched there. **No new tables, no
migration.** This RFC also replaces the placeholder home and **flips `0005` →
`Implemented`** (the spine is now fully consumed).

### Locked decisions (from PRD 008 + RFC 0005)

- **Current cycle:** `X` = real pooled balance now (ACTUAL already baked in);
  `Y` = remaining (PLANNED + projected) **obligations** in the cycle; `Z = X − Y`.
  Expected-but-unreceived income is **not** added (conservative — only spend what
  you hold); it's surfaced under "perlu konfirmasi".
- **Future cycle (labeled "proyeksi"):** `projectedOpening` = pooled now + net of
  all **pending** (PLANNED + projected) movements with `effectiveDate` in
  `[today, targetStart)`; `Z = projectedOpening + cycleIncome − cycleObligations`.
- **Per-day allowance** kept: current `Z ÷ days left`; future `Z ÷ days in cycle`.
- **Cycle range:** current + up to **12 forward**; one cycle back is read-only.

## 2. Design

New **`src/features/home/`** — orchestration + a pure forecast core (owns no table,
no `repository.ts`).

### Pure forecast core — `home/forecast.ts` (tested)

`pooledNow` already includes **all ACTUAL** movements (`deriveBalance` sums them
regardless of date), so the forecast only adds **pending** events (PLANNED
movements + projected recurring occurrences) — never ACTUAL (no double-count).

```ts
type ForecastEvent = {
  kind: "income" | "expense";
  amount: number;
  effectiveDate: Date;
  movementId: string | null;   // a PLANNED movement (confirmable)
  ruleId: string | null;       // a projected occurrence (materialize on confirm)
  cardId: string | null;
  categoryId: string | null;
  walletId: string;
  note: string | null;         // shown to tell same-tag items apart (projections carry the rule's note)
};

computeForecast(input: {
  pooledNow: number;
  perWallet: { walletId: string; balance: number }[];
  cycle: Cycle;
  isProjected: boolean;
  today: Date;
  events: ForecastEvent[];       // pending, from current-cycle-start … targetEnd
}): {
  cycle; isProjected; x; y; cycleIncome; z; perDayAllowance; daysLeft;
  perWallet; obligations: ForecastEvent[]; toConfirm: ForecastEvent[];
}
```

**Math (all `roundMoney`):**
- `inCycle(e)` = `cycle.start ≤ e.effectiveDate ≤ cycle.end`.
- `y` = Σ amount of EXPENSE events `inCycle`. `cycleIncome` = Σ INCOME events `inCycle`.
- **current** (`!isProjected`): `x = pooledNow`; `z = x − y`.
- **future**: `interveningNet` = Σ signed (income +, expense −) events with
  `today ≤ effectiveDate < cycle.start`; `x = pooledNow + interveningNet`;
  `z = x + cycleIncome − y`.
- `daysLeft` (current) = `max(1, (cycle.end − toCycleDate(today))/day + 1)`;
  `perDayAllowance` = `max(0, z) / daysLeft`. Future: `daysLeft` = days in cycle.
- `obligations` = EXPENSE events `inCycle` (the Y list, sorted by date).
- `toConfirm` = current cycle only: pending events with `effectiveDate ≤ today`
  (income to receive + obligations to pay). Empty for future cycles.

### Service — `home/service.ts` (composition; no Prisma)

`getCycleForecast(userId, offset = 0, now = new Date())`:
1. `{ pooled, perWallet }` ← `wallets.service.listWallets` (pooled + per-wallet derived).
2. `anchorDay` ← `recurring.repository.findPrimaryIncome` (`?? 1`).
3. `targetCycle = getCycleByOffset(anchorDay, now, offset)`;
   `currentCycle = getCurrentCycle(anchorDay, now)`.
4. Movements in `[currentCycle.start, targetCycle.end]` ←
   `movements.repository.listByUserInWindow`; keep **PLANNED** (ACTUAL already in pooled).
5. Rules ← `recurring.listActiveRules`. For each cycle offset `0..offset`,
   `projectOccurrences(rules→toProjectionRule, cycleₒ, materializedInCycleₒ)`
   where `materializedInCycleₒ` = ruleIds of the window's movements (any status)
   whose `effectiveDate` falls in cycleₒ. (No double-count.)
6. Build `ForecastEvent[]` = PLANNED movements + projected occurrences (kind from
   `type`). Call `computeForecast`.
7. Also return the **cycle strip**: `getCycleRange(anchorDay, now, { back: 0, forward: 12 })`
   labels for the switcher.

> **Cost:** for offset *N* the service runs `N+1` pure `projectOccurrences` calls
> over the in-memory rule set plus a single windowed movement query — cheap at
> personal scale, no extra round-trips per cycle.

### Confirm — reuse `0007`/`0008`

The home's "perlu konfirmasi" one-tap buttons call the existing confirm actions
(no new write paths): income → `income.confirmIncomeAction` /
`confirmRecurringIncomeAction`; expense → `expenses.confirmObligationAction` /
`confirmRecurringObligationAction`. A `ForecastEvent` carries the discriminators
(`kind`, `movementId` vs `ruleId` + `effectiveDate`) the actions need.

### UI

- **Route `/`** (replaces the placeholder home). Server component reads
  `?offset` (clamped `0 … 12`), calls `getCycleForecast`, maps to a DTO, renders
  `<HomeView>`. Wallets/cards/categories names resolved for labels.
- **`HomeView`** (client; matches the approved mockup):
  - **Header** — greeting + **cycle pill** — the shared `<CycleSwitcher>`
    (`src/components/cycle-switcher.tsx`, a dropdown-▾ linking `?offset`). Extracted
    so `/expenses` reuses the identical switcher (polish #3a); takes `strip`,
    `current` offset, and a `basePath` (`"/"` here, `"/expenses"` there).
  - **Hero** — "Aman dipakai sampai gajian" + **Z**; future cycles badge
    **"proyeksi"**; per-day allowance microcopy; days-left meta.
  - **X − Y row** — "Punya sekarang" (X) − "Bakal keluar" (Y).
  - **Dompet** — per-wallet breakdown (links to `/wallets`).
  - **Jatuh tempo siklus ini** — the Y obligation list (date, source/card, note, amount),
    "due soon" emphasis. The note (if any) is appended to the subtitle so same-tag
    items are distinguishable; projected occurrences carry the rule's note too.
  - **Perlu konfirmasi** — `toConfirm` items, one-tap confirm (current cycle).
  - **＋** FAB → links to `/expenses` (capture). (A shared bottom-sheet capture is a
    later polish; MVP routes to the expense page.)
- States: empty (no primary income → nudge to set salary on `/income`); loading;
  error via toast.

## 3. Alternatives considered

- **Materialize future occurrences to compute Z** — rejected (RFC 0005);
  compute-on-read keeps projection a pure function over the rule set.
- **Per-offset round-trips for the switcher** — rejected; one windowed query +
  N pure projections covers current→target. (Each offset is a fresh page load via
  `?offset`, so only the selected cycle is computed per request anyway.)
- **Adding expected income to the current Z** — rejected (PRD): only count money
  in hand for "safe to spend now"; show expected income under confirm.
- **A denormalized forecast cache** — rejected; derive it, revisit only if a real
  perf issue appears.

## 4. Risks & trade-offs

- **Double-count (ACTUAL vs pending).** Forecast adds only PLANNED + projected;
  pooled already holds ACTUAL. Covered by tests.
- **Projection across multiple cycles** (future offsets). Each intervening cycle
  is projected and its materialized rules excluded; tested for a 1- and 2-cycle
  forward case.
- **Timezone / day math.** `daysLeft` normalizes `today` via `toCycleDate`; all
  cycle dates are UTC-midnight Jakarta dates.
- **Negative Z.** Allowed and surfaced (the answer can be "you're over"); per-day
  allowance floors at 0 so it never shows a negative daily figure.
- **Empty state.** No primary income → calendar-month cycle + a nudge; the number
  still computes (just less meaningful) — we label and guide rather than block.
- **Security.** Every read scoped by `userId`; confirm actions re-check session.

## 5. Test plan

**Unit (pure `home/forecast.ts`):**
- Current: `z = pooled − Y`; income events ignored in `z` but present in
  `cycleIncome` + `toConfirm`; obligations list = in-cycle expenses.
- Future: `projectedOpening = pooled + interveningNet`; `z = opening + income − Y`;
  `toConfirm` empty.
- `perDayAllowance` = `z / daysLeft` (current) / days-in-cycle (future); floors at 0.
- ACTUAL-not-double-counted (only pending events passed in).

**Unit (service, deps mocked):** builds events from PLANNED movements + projected
occurrences across offsets `0..N`; excludes materialized rules per cycle; passes
`pooledNow`/`perWallet` from wallets; returns the cycle strip.

**Manual:** seed salary + wallets + a CC obligation next cycle; home shows Z for
this cycle; switch forward → projected Z drops by the obligation; confirm a due
item → Y shrinks, X updates.

## 6. Rollout

1. No migration. Add `src/features/home/` (forecast, service, types, mapper,
   components). Replace `app/(app)/page.tsx`.
2. `bun run test` · `type-check` · `lint` · `build` green; `/simplify` + `/code-review`.
3. **Flip RFC `0005` → `Implemented`** (spine fully consumed); update its checklist.
4. Back-out: restore the placeholder `page.tsx`, delete `home/`.

## 7. Implementation checklist

- [x] `home/forecast.ts` (`computeForecast`, pure) + tests (6)
- [x] `home/service.ts` (`getCycleForecast` + cycle strip) + tests (2)
- [x] `home/types.ts` + `mapper.ts`
- [x] `home/components/home-view.tsx` (hero, X−Y, wallets, obligations, confirm,
      switcher) — reuses `0007`/`0008` confirm actions
- [x] Replace `app/(app)/page.tsx`
- [x] `bun run test` (125) · `type-check` · `lint` · `build` clean
- [x] `/simplify` + `/code-review` run — applied: `toConfirm` in-cycle guard;
      `getCycleForecast` returns its wallet data so the page avoids a second
      `listWallets`; shared `formatDateShort` → `src/lib/date.ts`
- [x] This RFC `Implemented` + `last_verified`; **`0005` flipped → `Implemented`**
- [x] Roadmap MVP `e` + `f` ✅ → MVP complete

> **Implementation notes (review-applied):**
> - **Past cycles dropped from the switcher** (current + 12 forward only): a
>   correct past `X` needs the cycle's opening balance reconstructed (out of MVP
>   scope); showing today's pooled balance for a past cycle would mislead.
> - `toConfirm` is guarded to in-cycle items only (correct-by-construction).
> - The capture `＋` routes to `/expenses`; a shared bottom-sheet capture is a
>   later polish.
