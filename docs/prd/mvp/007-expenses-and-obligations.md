---
id: "007"
title: Expenses & obligations
status: Approved
phase: MVP
owner: PM
created: 2026-06-05
last_updated: 2026-06-06
rfc: "0005"
---

# 007 — Expenses & obligations

## 1. Problem / Frustration

Expenses are where the money leaks — and where the forgetting happens. But the
deeper problem is **timing**: a credit-card swipe today doesn't hit the wallet
today, it hits weeks later when the bill is due. If the app records every expense
as "now", the forecast lies and the mid-cycle shock returns. The user needs each
expense tagged with **how it was paid** (so the app knows _which cycle_ it lands
in), and needs **fixed recurring costs** (cicilan pinjol, SPP adek) represented so
they're never a surprise.

> **This PRD owns the "money movement" — the shared primitive** behind the whole
> app: a dated money event with a state (committed vs moved) and an effective
> date. Per the locked model: **cash hits now**; **credit card / paylater /
> recurring create obligations** that hit the paying wallet on their due date.
> CC & paylater are payment instruments, not wallets.

## 2. Goals

- Record an expense fast (amount, category, date, note) — capture stays quick.
- Capture **payment method** (cash · credit card · paylater) — this decides timing.
- **Cash** deducts the wallet now; **CC / paylater** create an **obligation** due
  later that deducts the paying wallet on its due date.
- Represent **recurring fixed obligations** (cicilan, SPP) that appear each cycle.
- Every obligation due in a cycle rolls up into **Y "bakal keluar"** for that cycle.
- Edit / delete; review a list of expenses & upcoming obligations.

## 3. Non-goals

- **Line-item detail** per transaction (cash: groceries; CC: a Tokopedia order)
  → Phase 3 (`k`). MVP = one expense, one amount + category.
- **Auto plan→execute** (obligations auto-converting to actual) → Phase 1 (`g`).
  MVP confirms "paid" manually (mirrors income receipt confirm).
- **Receipt OCR** → later (nice-to-have).
- **Transfers** between wallets → Phase 2 (`i`).
- Rich recurrence (bi-weekly, custom) → Phase 1 (`h`). MVP = monthly.
- Multi-currency · partial payments of an obligation.

## 4. User stories

- As a user, I log a **cash** expense and my wallet drops immediately.
- As a user, I log a **credit-card / paylater** expense, my wallet **doesn't**
  drop now, and an obligation appears in the cycle its due date falls in.
- As a user, I set up a **recurring obligation** (cicilan, SPP) once and it shows
  up automatically every cycle.
- As a user, I see the app tell me **which cycle** an expense will hit, as I enter
  it (the "impact preview" from the mockup).
- As a user, I **confirm an obligation paid** and it deducts the paying wallet.
- As a user, I edit or delete a wrong entry and balances stay correct.

## 5. Scope (this phase)

- Record an expense: **amount, category, transaction date, payment method,
  source, optional note**.
- **Payment method drives timing:**
  - `cash` → an **actual** movement on the transaction date; deducts the chosen
    wallet now.
  - `credit card` / `paylater` → a **planned obligation** with a **due date**;
    deducts the **paying wallet** when confirmed paid (or on due date).
- **Recurring obligation** (e.g. cicilan, SPP): amount, due day-of-month, paying
  wallet, category — auto-appears as an obligation each cycle (monthly).
- An obligation is **confirmed paid** via one-tap (mirrors income receipt); on
  confirm it becomes an actual movement and deducts the paying wallet.
- **Live "impact preview"** while entering: states whether it hits now or which
  future cycle it lands in (per the approved mockup).
- Obligations due within a cycle aggregate into **Y** for that cycle; the home
  groups them readably (e.g. "Tagihan CC BCA").
- **Categories** for expenses — managed list, user can add new (the categories
  feature `d`, folded in here for the expense side).
- Editing/deleting a movement keeps wallet balances correct (balances are derived).
- Every record owned by an authenticated `userId`.

## 6. Success metric

The user logs a credit-card expense and immediately sees it will hit a _future_
cycle (not now), and their fixed monthly obligations appear without re-entry — so
the cycle's "bakal keluar" (Y) reflects reality and the mid-cycle surprise stops.

## 7. Decisions (resolved 2026-06-05)

- **Credit-card billing — middle path:** a card has a **default due day** + paying
  wallet; each CC/paylater purchase becomes an obligation whose due date inherits
  from the card (editable per purchase); the home **groups by card** into one
  consolidated total. Full statement-closing logic (which purchases fall into which
  statement) is **deferred**.
- **Pay-from wallet on confirm:** defaults to the configured paying wallet,
  editable at confirm time.
- **Editing a recurring obligation:** applies to future occurrences only, never past.
- **Single occurrence:** the user can skip or adjust one occurrence (e.g. SPP
  waived a month) without changing the rule.
- _Left to RFC:_ the unified **movement** model (income, expense, obligation,
  adjustment; planned vs actual; effective date; recurrence) shared with `005`,
  `006`, `008`.
