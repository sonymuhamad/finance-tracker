---
id: "0002"
title: Categories
status: Implemented
prd: ../prd/mvp/002-categories.md
author: Engineering
created: 2026-06-01
last_updated: 2026-06-01
last_verified: 2026-06-01
---

# RFC 0002 — Categories

> Implements PRD [002](../prd/mvp/002-categories.md).

## 1. Context

Transactions need buckets to roll up into. Users manage their own categories,
scoped per user and per type (income/expense). New users get sensible defaults.

## 2. Design

### Data model
`Category` (already in schema): `id, userId, name, type (TransactionType),
color?, icon?, timestamps`. Unique `(userId, name, type)`. `Transaction.category`
uses `onDelete: Restrict`, so the DB blocks deleting a category in use.

### Layer flow (`src/features/categories/`)
- `defaults.ts` — the seed list (emoji icon + warm hex color) for expense & income.
- `schema.ts` — Zod `createCategorySchema` / `updateCategorySchema`
  (`name` 1–40 chars, `type`, optional `color`, `icon`).
- `repository.ts` — Prisma only: `listByUser`, `create`, `update`, `remove`,
  `createManyDefaults`.
- `service.ts`
  - `listCategories(userId)` — lazily seeds defaults if the user has none.
  - `createCategory / updateCategory / deleteCategory(userId, …)` — enforce
    ownership; map the `Restrict` FK violation on delete to a friendly error.
- `actions.ts` (`"use server"`) — `requireUser` → validate → service →
  `revalidatePath("/categories")`. Returns `{ ok }` / `{ error }`.

### UI
- `/categories` server page lists categories grouped by type.
- `category-form-dialog` (client) — add/edit via dialog (name, type, color, emoji).
- `category-row` with edit/delete; delete confirms; in-use deletes show the error.

## 3. Alternatives considered

- Seeding at user creation (Auth event) — rejected: couples auth to categories.
  Lazy seed on first list keeps the domain self-contained.
- Sub-categories — out of scope (PRD non-goal).

## 4. Risks & trade-offs

- Lazy seeding writes during a read; acceptable and idempotent (only when empty).
- Deleting an in-use category is blocked (PRD open question resolved: **block**,
  don't reassign — simplest correct behavior for MVP).

## 5. Test plan

- Unit: `createCategorySchema` validation; default list integrity (unique names
  per type). Service delete-in-use error mapping (logic-level).

## 6. Rollout

No new migration (model exists). No env.

## 7. Implementation checklist

- [x] defaults / schema / repository / service / actions
- [x] `/categories` page + dialog + row
- [x] Tests; `/simplify` + `/code-review`
- [x] RFC synced, `last_verified` set
