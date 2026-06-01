---
id: "002"
title: Categories
status: Draft
phase: MVP
owner: PM
created: 2026-06-01
last_updated: 2026-06-01
rfc:
---

# 002 — Categories

## 1. Problem / Frustration

"Where did my money go?" is unanswerable without grouping. Free-text notes don't
aggregate. The user needs simple buckets (food, transport, salary, …) to make
spending legible.

## 2. Goals

- The user can classify each transaction into a category.
- Categories are scoped per user and per type (income vs expense).
- Sensible default categories exist so the app is useful immediately.

## 3. Non-goals

- Sub-categories / hierarchies.
- Auto-categorization or rules.
- Per-category budgets (that's Phase 2, feature `d`).

## 4. User stories

- As a user, I pick a category when I record a transaction.
- As a user, I can add/rename/remove my own categories.

## 5. Scope (this phase)

- CRUD for categories (name, type, optional color/icon).
- Seed a small set of default categories for a new user.
- Uniqueness: no duplicate name+type per user.

## 6. Success metric

Every transaction in the dashboard rolls up under a category; the user can
manage their category list without friction.

## 7. Open questions

- Final default category list (proposed in RFC).
- Whether deleting a category with transactions is blocked or reassigns.
