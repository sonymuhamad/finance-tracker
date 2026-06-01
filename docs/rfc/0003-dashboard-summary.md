---
id: "0003"
title: Dashboard / monthly summary
status: Implemented
prd: ../prd/mvp/003-dashboard-summary.md
author: Engineering
created: 2026-06-01
last_updated: 2026-06-01
last_verified: 2026-06-01
---

# RFC 0003 — Dashboard / monthly summary

> Implements PRD [003](../prd/mvp/003-dashboard-summary.md).

## 1. Context

The payoff of recording: open the app and instantly see this month's
income/expense/net and where the money went, with a month switcher.

## 2. Design

### Layer flow (`src/features/dashboard/`)
- `period.ts` (pure, tested) — `monthRange(year, month)` → UTC `[start, end)`;
  `parseMonthParam("YYYY-MM")` with fallback to a given "now"; `shiftMonth`.
  Boundaries are UTC to match how `occurredAt` is stored (date-input → UTC midnight).
- `repository.ts` — Prisma aggregation:
  - `sumByType(userId, start, end)` → `groupBy(type)._sum.amount`.
  - `sumByCategory(userId, start, end)` → expense `groupBy(categoryId)._sum.amount`.
  - `categoriesByIds(userId, ids)` for breakdown metadata.
- `service.ts` — `getMonthlySummary(userId, year, month)` → `MonthlySummary`
  (income, expense, net, and expense `byCategory` sorted desc with `percentage`).
  Decimal sums converted to numbers here.

### UI
- `/` (dashboard) server page: reads `?m=YYYY-MM` (default = current month),
  computes the summary, renders:
  - greeting + `month-switcher` (client; prev/next → `?m=`).
  - summary cards: Pemasukan, Pengeluaran, Sisa (net).
  - expense breakdown: ranked list with a coloured progress bar + percentage.
  - quick `AddTransactionButton` (reuses the transactions form).
  - empty state when the month has no transactions.

## 3. Alternatives considered

- Aggregate in JS over all rows — rejected: DB `groupBy` is cleaner and scales.
- Charts library — deferred; a CSS bar list is enough and on-brand for MVP.

## 4. Risks & trade-offs

- Month boundaries are UTC; acceptable for a single-user MVP (revisit for TZ when
  opening to others — PRD open question noted).
- Net = income − expense for the selected month only.

## 5. Test plan

- Unit: `period.ts` — `monthRange` correctness (incl. December → next year),
  `parseMonthParam` valid/invalid, `shiftMonth` wrap-around.

## 6. Rollout

No migration. No env.

## 7. Implementation checklist

- [x] period / repository / service / types
- [x] dashboard page + month-switcher + cards + breakdown
- [x] Tests; `/simplify` + `/code-review`
- [x] RFC synced, `last_verified` set
