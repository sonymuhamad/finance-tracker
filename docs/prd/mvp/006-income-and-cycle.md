---
id: "006"
title: Income & payday cycle
status: Approved
phase: MVP
owner: PM
created: 2026-06-05
last_updated: 2026-06-06
rfc: "0005"
---

# 006 — Income & payday cycle

## 1. Problem / Frustration

Income isn't just a number to log after the fact — it's the **heartbeat that
defines the planning window**. The user's real fear is "will I make it to the next
paycheck?", which only has meaning if the app knows _when the paycheck lands_ and
_how much_. Income also comes from more than one place (salary, the occasional
side project) and the user wants to tell them apart. Without a defined payday
cycle, there is no "this cycle", no Y, and no "safe to spend" (Z).

> **This PRD owns the payday cycle.** Per the locked model, the cycle is anchored
> to the **primary recurring income**: change its date and the cycle follows — no
> code change. Holiday wobble is intentionally ignored (use the scheduled date).

## 2. Goals

- The user defines one **primary recurring income** (e.g. salary) that **anchors
  the payday cycle**.
- The app derives the **current cycle window** automatically (e.g. "25 Mei – 24
  Jun") with no date math from the user.
- The user can log **other income** (one-off or secondary), each with a **tag**.
- Income, once received, lands in a wallet and lifts that cycle's picture.

## 3. Non-goals

- **Income suggestions from history** ("set 14jt for the next 6 months") →
  Phase 3 (`l`). MVP lets the user set income manually.
- Holiday/weekend payday wobble (locked: ignored).
- Rich recurrence rules (bi-weekly, every-N-days) → Phase 1 (`h`). MVP = monthly.
- Multi-currency.

## 4. User stories

- As a user, I set my salary as **primary recurring income** (amount, the day it
  lands, destination wallet, tag), so the app knows my payday cycle.
- As a user, I see the **current cycle window** without calculating anything.
- As a user, I add **other income** (e.g. a side project payout) with a tag, so
  it's reflected when it arrives.
- As a user, I **tag** income (`gaji bulanan`, `side hustle`) to tell sources apart.
- As a user, when income actually arrives, it's **received into a wallet** and
  shows in that cycle.

## 5. Scope (this phase)

- Define exactly **one primary recurring income**: amount, **day-of-month** it
  lands, destination wallet, tag. This **anchors the cycle**.
- App computes the cycle window from that day-of-month (scheduled, not
  wobble-adjusted). Day clamps to the last day for short months (e.g. 31→28).
- Add **other income** in the current **or a future** cycle: amount, date,
  destination wallet, tag — one-off or a secondary recurring source (e.g. a
  side-project payout expected next month).
- The primary recurring income **auto-projects** across future cycles; together
  with forward one-off income this feeds the **multi-cycle view** owned by `008`.
- Income has two states (shared model): **expected/planned** vs
  **received/actual**. An expected income is confirmed received via an **in-app
  reminder with one-tap confirm** (amount defaults to the planned figure); on
  receipt it lands in the wallet balance.
- **Tags** for income — a **managed list the user can extend** (shared with the
  categories/tags mechanism), e.g. `gaji bulanan`, `side hustle`.
- Every income record owned by an authenticated `userId`.

## 6. Success metric

The app shows the correct payday cycle window and this cycle's income with zero
date math from the user — the user trusts "this cycle = 25 Mei – 24 Jun" and sees
their salary reflected the day it lands.

## 7. Decisions (resolved 2026-06-05)

- **Forward income & the multi-cycle view are MVP** (not Phase 1): the user can
  set income in future cycles, and the home gets a **cycle switcher** to view the
  current cycle and project forward. The switcher + per-cycle projection are owned
  by the home PRD (`008`); the roadmap moves feature `f` into MVP.
- **Receipt confirmation:** the user confirms via an **in-app reminder + one-tap
  confirm**; amount defaults to the planned figure. (Real push notifications later.)
- **Tags:** managed list, and the user **can add new tags**.
- **Editing the primary income's day:** recomputes the current + future cycles,
  never the past.
- **No primary income yet:** cycle falls back to the calendar month with a nudge
  to set one. _(PM default — flag if you'd rather block until set.)_
- _Guardrails (YAGNI):_ MVP recurrence stays **monthly**; rich schedules
  (bi-weekly, etc.) and history-based suggestions stay later phases.
- _Left to RFC:_ recurrence + planned/received representation (shared with `007`);
  projecting a **future** cycle's opening balance = today's balance + net
  movements until then (owned with `008`).
