---
id: "0001"
title: Record transactions
status: Implemented
prd: ../prd/mvp/001-record-transaction.md
author: Engineering
created: 2026-06-01
last_updated: 2026-06-01
last_verified: 2026-06-01
---

# RFC 0001 — Record transactions

> Implements PRD [001](../prd/mvp/001-record-transaction.md).

## 1. Context

The core loop: capture income/expense fast, then review. Each transaction
belongs to a user and a category; amount is fixed-precision money.

## 2. Design

### Data model
`Transaction` (already in schema): `id, userId, categoryId, type, amount
Decimal(18,2), occurredAt, note?, timestamps`. Indexed on `(userId, occurredAt)`.

Money: stored as `Decimal`; converted to a `number` (major unit) at the
repository boundary via a mapper. The form parses input with `parseAmount`
(see `src/lib/money.ts`).

### Layer flow (`src/features/transactions/`)
- `schema.ts` — `createTransactionSchema` (`type`, `amount` > 0, `categoryId`,
  `occurredAt` date, `note?` ≤ 140). `updateTransactionSchema` adds `id`.
- `repository.ts` — Prisma only: `listByUser` (newest first, category joined,
  limit), `create`, `update` (scoped by userId), `remove`, `findCategoryOwned`.
- `service.ts`
  - `listRecent(userId, limit)` → DTOs (Decimal→number, dates→ISO).
  - `createTransaction(userId, input)` — verifies the category is owned by the
    user **and** its type matches `input.type` (else `DomainError`).
  - `updateTransaction` / `deleteTransaction` — ownership-scoped.
- `actions.ts` (`"use server"`) — `requireUser` → validate → service →
  `revalidatePath("/")` and `("/transactions")`.

### UI
- `/transactions` lists transactions grouped by day with running labels.
- `transaction-form-dialog` (client): pick type → category (filtered by type) →
  amount → date (default today) → note. Reused for create & edit.
- `add-transaction-button` (client) reused on the dashboard for quick capture.
- `transaction-row` (client): edit (dialog) + delete (confirm).

## 3. Alternatives considered

- Store amount as integer minor units — rejected for MVP: `Decimal` + a single
  conversion point is clear enough and avoids unit juggling in the UI.
- Single combined type+category field — rejected: explicit type keeps the
  category list short and the data consistent.

## 4. Risks & trade-offs

- Decimal→number conversion loses precision only beyond ~15 digits; fine for
  personal amounts. Totals are summed in the DB (see dashboard RFC) where it matters.
- Category/type mismatch guarded in the service, not just the UI.

## 5. Test plan

- Unit: `createTransactionSchema` (amount > 0, coercion, note length); money
  `parseAmount` already covered.

## 6. Rollout

No new migration (model exists). No env.

## 7. Implementation checklist

- [x] schema / repository / service / actions / types
- [x] `/transactions` page + form dialog + row + add button
- [x] Tests; `/simplify` + `/code-review`
- [x] RFC synced, `last_verified` set
