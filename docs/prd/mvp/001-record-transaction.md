---
id: "001"
title: Record transactions
status: Implemented
phase: MVP
owner: PM
created: 2026-06-01
last_updated: 2026-06-01
rfc: ../../rfc/0001-record-transaction.md
---

# 001 — Record transactions

## 1. Problem / Frustration

The whole product hinges on this: capturing income and expenses must be faster
and less error-prone than a spreadsheet, especially on a phone. If logging is
slow, the user stops doing it and the data dies.

## 2. Goals

- Add an income or expense in seconds: amount, category, date, optional note.
- Edit and delete past entries.
- See a list of recent transactions.

## 3. Non-goals

- Multiple wallets / account balances (Phase 1, feature `c`).
- Recurring/scheduled transactions (Phase 2, feature `f`).
- Attachments/receipts, splits, multi-currency.

## 4. User stories

- As a user, I quickly log an expense with amount + category so it's captured.
- As a user, I log income the same way.
- As a user, I fix or delete a wrong entry.
- As a user, I review my recent transactions.

## 5. Scope (this phase)

- Create / edit / delete a transaction (type, amount, category, date, note).
- Amount handled as fixed-precision (no float drift); IDR default.
- Recent-transactions list (paginated or "load more").
- Fast input form optimized for mobile.

## 6. Success metric

The user can record a transaction in a few taps and trusts the list is accurate;
this becomes a daily habit during MVP.

## 7. Open questions

- Default date = today, editable? (proposed: yes)
- Quick-add affordance on the dashboard vs a dedicated page (decide in RFC/UI).
