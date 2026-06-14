---
id: "0005"
title: "Foundation — Movement + Cycle model"
status: Implemented # Draft → Approved → In Progress → Implemented
prd: # docs/prd/mvp/005-wallets.md, 006-income-and-cycle.md, 007-expenses-and-obligations.md, 008-home-safe-to-spend.md
author: Engineering
created: 2026-06-06
last_updated: 2026-06-06
last_verified: 2026-06-14 # SKIPPED MovementStatus added (per-occurrence skip, RFC 0008)
---

# RFC 0005 — Foundation: Movement + Cycle model

> **Accuracy rule:** this RFC must match what's in the code. If the
> implementation changes, update this document in the same change.

## 1. Context

The product was pivoted (2026-06-05) from a retrospective tracker to a
**forward-looking cash-flow forecaster** answering _"how much can I safely spend
before my next paycheck?"_ — the **X − Y = Z** model on top of payday cycles.

Four Approved MVP PRDs share one spine and explicitly defer their data model to
"the RFC":

- [`005` Wallets & balance](../prd/mvp/005-wallets.md) — X "punya sekarang".
- [`006` Income & payday cycle](../prd/mvp/006-income-and-cycle.md) — anchors the cycle.
- [`007` Expenses & obligations](../prd/mvp/007-expenses-and-obligations.md) — owns the
  "money movement" primitive; payment method drives timing.
- [`008` Home — safe to spend](../prd/mvp/008-home-safe-to-spend.md) — computes &
  displays X − Y = Z + cycle switcher.

**This is the foundation RFC.** It establishes the shared data model, the cycle
math, balance derivation, and the forecast/projection contract that all four
features build on. Per-feature **actions + UI** land in thin follow-on RFCs
(`0006` wallets, `0007` income, `0008` expenses, `0009` home).

**What exists today (old retrospective MVP, branch `feat/mvp-v0.1`, not merged):**
`Transaction` (type/amount/occurredAt/category) + `Category` + Auth.js models.
The `Transaction` model is too thin for the new model (no wallet, no payment
method, no due date, no planned/actual) and is **replaced** by `Movement`.
Salvaged: auth (`0004`), the layering, `lib/money.ts`, `Category`, the theme.

### Locked decisions (from PRDs — inputs to this design)

- Money lives on **payday cycles**, anchored to the **primary recurring income**
  (data-driven; change its day-of-month → cycle follows). Holiday wobble ignored.
- Two states: **committed-but-unpaid** (PLANNED) vs **actually-moved** (ACTUAL);
  **payment method decides when** a movement crosses over.
- **Wallets** hold real money, **pooled** into one total. **CC & paylater are NOT
  wallets** — they create obligations paid _from_ a wallet on a due date.
- Confirmation (income received / obligation paid) is **manual one-tap** in MVP.
- Recurrence is **monthly only** in MVP. Forward look capped at **12 cycles**.

## 2. Design

Three architectural decisions (approved 2026-06-06):

1. **One `Movement` table** — the unified primitive for every money event
   (income, expense, obligation, adjustment), discriminated by `type` + `status`.
2. **Compute-on-read + materialize-on-confirm** — future recurring occurrences
   are projected virtually from `RecurringRule` (no stored rows); a concrete
   `Movement` row is written only when the user confirms (received / paid).
3. **`effectiveDate` is the cycle axis** — a movement lands in the cycle its
   `effectiveDate` falls in (cash = transaction date; CC/paylater = due date).

### Data model

New enums and models in `prisma/schema.prisma`. The old `Transaction` model and
`TransactionType` enum are **removed**; `Category.type` migrates to `MovementType`.

```prisma
enum MovementType {
  INCOME
  EXPENSE
  ADJUSTMENT          // manual balance correction (005); categoryId null
}

enum MovementStatus {
  PLANNED             // committed-but-unpaid: expected income, obligation due later
  ACTUAL              // money has moved; affects wallet balance
  SKIPPED             // a recurring occurrence skipped for one cycle (added in 0008); never affects balance
}

enum PaymentMethod {
  CASH                // hits now
  CREDIT_CARD         // obligation, due later
  PAYLATER            // obligation, due later
}

enum WalletType {
  CASH
  BANK
  EWALLET
}

enum CardKind {
  CREDIT_CARD
  PAYLATER
}

model Wallet {
  id              String     @id @default(cuid())
  userId          String
  name            String
  type            WalletType
  startingBalance Decimal    @default(0) @db.Decimal(18, 2)
  isPrimary       Boolean    @default(false)
  emoji           String?
  color           String?
  archivedAt      DateTime?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  movements      Movement[]
  cards          Card[]
  recurringRules RecurringRule[]

  @@index([userId])
}

model Card {
  id             String    @id @default(cuid())
  userId         String
  name           String
  kind           CardKind
  defaultDueDay  Int                       // 1..31, clamps to month end
  payingWalletId String
  archivedAt     DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  payingWallet   Wallet          @relation(fields: [payingWalletId], references: [id], onDelete: Restrict)
  movements      Movement[]
  recurringRules RecurringRule[] // recurring obligations paid via this card

  @@index([userId])
}

model RecurringRule {
  id              String       @id @default(cuid())
  userId          String
  type            MovementType                // INCOME | EXPENSE (never ADJUSTMENT)
  amount          Decimal      @db.Decimal(18, 2)
  dayOfMonth      Int                         // 1..31, clamps for short months
  walletId        String                      // income destination / expense paying wallet
  cardId          String?                     // recurring obligation paid via a card
  categoryId      String?
  isPrimaryIncome Boolean      @default(false) // the ONE that anchors the cycle
  note            String?
  startsOn        DateTime                     // first cycle this rule applies
  endedAt         DateTime?                    // edits/stops apply to the future only
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  wallet    Wallet     @relation(fields: [walletId], references: [id], onDelete: Restrict)
  card      Card?      @relation(fields: [cardId], references: [id], onDelete: SetNull)
  category  Category?  @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  movements Movement[]                         // materialized occurrences (on confirm)

  @@index([userId])
}

model Movement {
  id              String         @id @default(cuid())
  userId          String
  type            MovementType
  status          MovementStatus
  amount          Decimal        @db.Decimal(18, 2)  // always positive; type implies sign
  walletId        String                              // income → destination; expense → paying wallet
  cardId          String?                             // set for CC/paylater obligations
  categoryId      String?                             // null for ADJUSTMENT
  paymentMethod   PaymentMethod?                      // null for INCOME / ADJUSTMENT
  occurredAt      DateTime                            // when the event happened (swipe/entry)
  effectiveDate   DateTime                            // when money moves → cycle assignment
  note            String?
  recurringRuleId String?                             // set if generated from a rule
  confirmedAt     DateTime?                           // set when PLANNED → ACTUAL
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  wallet        Wallet         @relation(fields: [walletId], references: [id], onDelete: Restrict)
  card          Card?          @relation(fields: [cardId], references: [id], onDelete: SetNull)
  category      Category?      @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  recurringRule RecurringRule? @relation(fields: [recurringRuleId], references: [id], onDelete: SetNull)

  @@index([userId, effectiveDate])
  @@index([walletId])
  @@index([cardId])
  @@index([categoryId])
  @@index([recurringRuleId])
}

// Reused — type widened to MovementType; service enforces INCOME | EXPENSE only.
model Category {
  id        String       @id @default(cuid())
  userId    String
  name      String
  type      MovementType
  color     String?
  icon      String?
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  movements      Movement[]
  recurringRules RecurringRule[]

  @@unique([userId, name, type])
  @@index([userId])
}
```

`User` gains `wallets Wallet[]`, `cards Card[]`, `recurringRules RecurringRule[]`,
`movements Movement[]` (replacing `transactions`).

**Invariants enforced in the service layer** (inside a Prisma transaction —
unset the old primary before setting the new one):

- At most one **primary wallet** per user among non-archived.
- At most one **primary income** (`RecurringRule.isPrimaryIncome`) per user among
  active rules — this is what anchors the cycle.
- `Category.type` and `RecurringRule.type` ∈ {INCOME, EXPENSE}.

> _Note:_ a DB partial unique index would be a stronger guard, but Prisma 7 can't
> express filtered uniques in the schema, so a raw-SQL index would read as drift on
> every later `migrate dev`. For a single-user-per-account app there's no real
> concurrent toggle, so service-layer enforcement (in a transaction) is sufficient.

#### Field semantics that matter

| Field | Meaning |
|---|---|
| `Movement.walletId` | INCOME → destination wallet; EXPENSE/obligation → the **paying** wallet (where it leaves on `effectiveDate`); ADJUSTMENT → the corrected wallet. |
| `Movement.effectiveDate` | The date money actually moves. **Cash** = `occurredAt`. **CC/paylater** = the due date (from the card / editable). Determines the cycle. |
| `Movement.status` | `PLANNED` = expected/obligation (does **not** affect balance yet). `ACTUAL` = moved (affects balance). `SKIPPED` = a recurring occurrence skipped for one cycle (added in `0008`; like PLANNED it never affects balance, and it's kept out of Y). `confirmedAt` set on the PLANNED→ACTUAL flip. |
| `Movement.cardId` | Links a CC/paylater obligation to its card → home groups obligations per card. |
| `RecurringRule.isPrimaryIncome` | The single rule whose `dayOfMonth` anchors the payday cycle. |

### The cycle math — `src/lib/cycle.ts` (pure, no I/O)

The payday cycle is derived from the primary income's `dayOfMonth` (`anchorDay`).
A cycle runs from `anchorDay` of one month (inclusive) to the day before
`anchorDay` of the next month (inclusive). `anchorDay` clamps to month length
(e.g. 31 → 28/30). All dates are computed in **Asia/Jakarta**, date-only.

```ts
export type Cycle = {
  offset: number      // 0 = current, +N forward, -N past
  start: Date         // inclusive, 00:00 Asia/Jakarta
  end: Date           // inclusive last day
  label: string       // e.g. "25 Mei – 24 Jun"
  isCurrent: boolean
}

getCurrentCycle(anchorDay: number, today: Date): Cycle
getCycleByOffset(anchorDay: number, today: Date, offset: number): Cycle
getCycleRange(anchorDay: number, today: Date, opts: { back: number; forward: number }): Cycle[]
cycleOf(anchorDay: number, today: Date, date: Date): number   // which offset a date falls in
```

**Fallback (no primary income yet, per `006`):** `anchorDay = 1` → cycles are
calendar months; the UI nudges the user to set a primary income.

### Shared domain modules (this RFC implements the data layer + core services)

Movement is the spine, read across features. To keep the "repository is the only
Prisma layer" rule clean, two **shared domain modules** own the spine; feature
modules compose their services:

```
src/lib/cycle.ts                     # pure cycle math (this RFC)
src/features/movements/
  repository.ts                      # ALL Movement queries (this RFC)
  service.ts                         # create/confirm/adjust + balance math (this RFC)
  schema.ts  types.ts  __tests__/
src/features/recurring/
  repository.ts  service.ts          # RecurringRule CRUD + occurrence projection (this RFC)
  schema.ts  types.ts  __tests__/
src/features/wallets/                # 0006: wallet CRUD (balance via movements svc)
src/features/cards/                  # 0008: card CRUD (or folded into expenses)
src/features/income/                 # 0007: income actions/UI on movements + recurring
src/features/expenses/               # 0008: expense actions/UI on movements + cards
src/features/home/                   # 0009: forecast service + UI (composes everything)
```

Cross-module composition is **service → other module's repository/service** (one
direction, never back into actions). Example: `home.service` →
`movements.repository` + `recurring.service` + `wallets.repository` + `cycle`.

### Layer flow — what this RFC builds vs what features compose

This RFC ships the **spine**: the pure domain logic + the data layer. The
create/confirm *orchestration* (which resolves card due dates, paying wallets and
timing) lands in the feature RFCs that own those workflows (`0007` income, `0008`
expenses), composing the primitives below.

**`lib/cycle.ts`** (pure, tested) — `getCurrentCycle`, `getCycleByOffset`,
`getCycleRange`, `cycleOf`, `occurrenceDateInCycle`.

**`features/movements`** (the spine module):
- `balance.ts` (pure, tested) — `deriveBalance(startingBalance, movements)`
  (`startingBalance + Σ ACTUAL INCOME − Σ ACTUAL EXPENSE ± Σ ACTUAL ADJUSTMENT`;
  planned ignored); `resolveTiming(method, occurredAt, dueDate)` (cash → ACTUAL
  now / CC·paylater → PLANNED on due date); `adjustmentDelta(current, target)`.
- `repository.ts` — Movement queries: `create`, `listActualByWallet`,
  `listActualByUser`, `listByUserInWindow`, `findById`, `confirm`, `remove`,
  `findByRuleOnDate` (added in `0007`: confirm-idempotency guard — a movement
  already materialized from a rule on a given effective date).
- `service.ts` — primitives: `createMovement`, `confirmMovement` (flip PLANNED →
  ACTUAL, stamp `confirmedAt`, overridable wallet/amount/date), `deleteMovement`;
  re-exports the pure helpers. (Balances are derived, so edit/delete needs no
  counter fix-up.)

**`features/recurring`**:
- `projection.ts` (pure, tested) — `projectOccurrences(rules, cycle,
  materializedRuleIds)`: virtual occurrences from active rules in a cycle,
  **excluding** any rule already materialized for that cycle (no double-count),
  honoring `startsOn` / `endedAt`.
- `repository.ts` — `create`, `update` (added in `0007`: edit a rule in place),
  `listActive`, `findById`, `findPrimaryIncome`, `end`, `setPrimaryIncome`
  (atomic unset-then-set in a `$transaction`).
- `service.ts` — `createRule` (atomically makes a primary income the only one),
  `updateRule` (added in `0007`: edit in place, future-only), `setPrimaryIncome`,
  `endRule` (future-only), `listActiveRules`, `getCycleAnchorDay` (primary income's
  day, else 1 → calendar months), `toProjectionRule`; re-exports `projectOccurrences`.

**Derived balances** (`walletBalance`, `pooledBalance`) compose
`movements.repository` + `deriveBalance` and live in the **wallets** feature
(`0006`), since they need the wallet's `startingBalance`.

**Forecast (contract here; UI in `0009`)** — `home.service.getCycleForecast(userId, offset)`:

```ts
type CycleForecast = {
  cycle: Cycle
  isProjected: boolean                          // true for future cycles
  x: { amount: Decimal; perWallet: WalletSlice[] }   // current = real pooled; future = projected opening
  y: { total: Decimal; groups: ObligationGroup[] }   // grouped per card / recurring / paylater
  cycleIncome: Decimal                          // income landing in this cycle
  z: Decimal                                    // safe to spend (see math below)
  perDayAllowance: Decimal                      // z / days left (current cycle)
  toConfirm: ConfirmItem[]                      // planned income received / obligations due
}
```

**Z math:**

- **Current cycle:** `X` = real pooled balance now (ACTUAL already baked in).
  `Y` = remaining (PLANNED + virtual) obligations with `effectiveDate` in the
  cycle. `Z = X − Y`. (Already-paid items reduced `X`, so they're not in `Y`.)
- **Future cycle (projected):** `projectedOpening` = pooled balance now + net of
  **all** movements (ACTUAL + PLANNED + virtual) with `effectiveDate` between now
  and the cycle start. Then `Z = projectedOpening + cycleIncome − cycleObligations`
  (the `008` decision). `isProjected = true` → UI labels it "proyeksi".

### Server Actions / API

Defined per feature in their RFCs. This RFC only fixes the **Zod input shapes**
(`schema.ts`) for the shared create/confirm paths so the action layer stays a thin
auth + validate wrapper. No HTTP route handlers — all via Server Actions.

### UI

None in this RFC (foundation). The home, capture sheet, and impact preview are
specified in `0009` and follow the approved mockup
(`docs/mockups/mvp-hero-screens.html`).

## 3. Alternatives considered

- **Separate tables per movement kind** (Income / Expense / Obligation): more
  "typed", but every cross-cutting read (balance, Y, projection) would `UNION`
  three shapes, and the planned→actual flip would move rows between tables.
  Rejected — the unified `Movement` is simpler and matches the PRDs' "one
  primitive".
- **Materialize all future occurrences** (generate rows ahead): uniform reads,
  but needs a generator job, risks duplicate/stale rows, and editing a rule must
  reconcile unmaterialized future rows. Rejected for **compute-on-read +
  materialize-on-confirm** — future projection becomes a pure function.
- **Store a denormalized wallet balance**: faster reads, but a second source of
  truth to keep correct on every edit/delete/confirm. Rejected — derive it; add a
  cache only if a real perf problem appears (see Risks).
- **Squash to a fresh init migration**: cleaner history, but rewrites an existing
  migration. Rejected for an additive migration (standard Prisma flow).

## 4. Risks & trade-offs

- **Derived-balance performance.** Balance/forecast sum movements per request.
  Fine at personal scale (hundreds–thousands of rows) with the `[userId,
  effectiveDate]` index. If it bites: a periodic snapshot/materialized balance.
- **Double-counting projected vs materialized.** The projection MUST exclude
  (ruleId, cycle) pairs that already have a `Movement`. Covered by a dedicated
  test; the `recurringRuleId` index supports the lookup.
- **Timezone / cycle boundaries.** All cycle math in Asia/Jakarta, date-only, to
  avoid an expense near midnight landing in the wrong cycle. `cycle.ts` is pure
  and unit-tested at month-length edges (Feb, 30/31-day months, `anchorDay` 29–31).
- **Date normalization convention.** Every cycle-aligned date (cycle boundaries,
  `effectiveDate`, `startsOn`, `endedAt`) is the **UTC midnight of its Jakarta
  calendar date** — produced by `cycle.toCycleDate(date)`. Comparisons (`projection`
  guards, the cycle-window query) assume this. Feature write paths (`0007`/`0008`)
  MUST run user-entered dates through `toCycleDate` before persisting, so a stored
  time-of-day can't shift a movement across a cycle boundary. `projectOccurrences`
  normalizes `startsOn`/`endedAt` defensively.
- **High payday anchor (`dayOfMonth` ≥ 29) shortens cycles.** When the primary
  income anchors on 29–31, the clamp makes some cycles short (e.g. Jan 31 – Feb 27),
  so a monthly occurrence can fall *outside* a cycle or *twice within* one, and
  `occurrenceDateInCycle` returns only the first → under/over-count. Anchors ≤ 28
  are always clean (every month has ≥ 28 days). **MVP mitigation:** constrain the
  **primary income** `dayOfMonth` to **1–28** (enforced in `0007`'s Zod) and
  document the limit; revisit with a per-calendar-month projection for end-of-month
  paydays in a later phase. (Obligation `dayOfMonth` may stay 1–31 — only the
  anchor shortens cycles.)
- **Singleton invariants** (one primary wallet, one primary income) enforced in
  the service inside a transaction (unset old → set new). DB partial uniques were
  rejected (Prisma drift); acceptable for a single-user-per-account app.
- **Destructive migration.** Dropping `Transaction` loses old retrospective data
  — acceptable: nothing deployed, no real data, dev DB resettable.
- **Security.** Every query scoped by `userId`; actions re-check the session.
- **Delete guards (`Restrict`).** `Movement`/`RecurringRule` → `wallet` and
  `category` are `onDelete: Restrict`, so a wallet or **category in use can't be
  deleted** (history stays intact; the service surfaces a friendly error on the
  `P2003`). `card` and `recurringRule` references are `SetNull` (the obligation
  survives, just loses the link). Wallet archive (`005`) layers on top of this.

## 5. Test plan

**Unit (pure / service):**

- `cycle.ts`: current cycle, offsets, ranges, `cycleOf`, label formatting; edges —
  `anchorDay` 28–31, Feb, 30/31-day months, year rollover, calendar-month fallback.
- `movements.service`: balance derivation across INCOME/EXPENSE/ADJUSTMENT and
  PLANNED vs ACTUAL; confirm flips status + deducts the paying wallet; cash vs
  obligation `effectiveDate`; edit/delete keeps balance correct.
- `recurring.service`: `projectOccurrences` window membership + clamping; the
  materialized-exclusion (no double count); edits apply to future only.
- Forecast Z math: current (X − remaining Y) and future (projected opening +
  income − obligations); per-day allowance; `isProjected` flag.

**Manual:** seeded user → set primary income → cycle window correct; cash expense
drops a wallet now; CC expense lands next cycle (impact preview); confirm an
obligation deducts the paying wallet; switch a cycle forward → projected Z.

## 6. Rollout

1. Edit `prisma/schema.prisma` (enums + models above; update `Category`/`User`).
2. `bun run db:migrate` → new migration `add_cashflow_foundation`. Singletons are
   service-enforced (no raw-SQL index — see Data model note).
3. `bun run db:generate` (postinstall also runs it).
4. Implement `lib/cycle.ts`, `features/movements`, `features/recurring` + tests.
5. Old `transactions` + `dashboard` feature code is removed/reworked in the
   feature RFCs (`0007`/`0009`); the build stays green by landing the foundation +
   first dependent feature together on `feat/mvp-v0.1`.
6. Back-out: revert the migration (dev DB reset) and the branch; nothing deployed.

## 7. Implementation checklist

- [x] Schema updated (enums, `Wallet`, `Card`, `RecurringRule`, `Movement`,
      `Category` widened, `User` relations); old `Transaction`/`TransactionType` dropped
- [x] Migration written & applied (`20260606024442_add_cashflow_foundation`)
- [x] `src/lib/cycle.ts` + tests
- [x] `features/movements` — `balance.ts` (tested) + repository + service
- [x] `features/recurring` — `projection.ts` (tested) + repository + service
- [x] Old `transactions` + `dashboard` features removed; `categories` migrated to
      `MovementType` (narrowed `CategoryType`); home stubbed
- [x] `bun run test`, `type-check`, `lint` clean (125 tests across the MVP)
- [x] Forecast service implemented + UI — `0009` (`home.getCycleForecast` + `forecast.ts`)
- [x] Create/confirm orchestration — income `0007`, expenses/obligations `0008`
      (`recordExpense`, `addOneOff/RecurringIncome`, confirm + materialize paths)
- [x] `/simplify` + `/code-review` run on each feature diff
- [x] Status → `Implemented` — the spine is fully consumed by `0006`–`0009`.
      Later additions: `recurring.update`/`updateRule` + `movements.findByRuleOnDate`
      (see Data model / Shared modules notes above).

## 8. Follow-on RFCs

| RFC | Covers | PRD |
|---|---|---|
| `0006` | Wallets — CRUD, primary, archive, balance UI | `005` |
| `0007` | Income — primary recurring + one-off + forward, tags, confirm | `006` |
| `0008` | Expenses & obligations — cards, payment-method timing, impact preview, confirm | `007` |
| `0009` | Home — X→Y→Z, cycle switcher, projection UI, "perlu konfirmasi" | `008` |
