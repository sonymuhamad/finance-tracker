---
id: "000"
title: Product Vision
status: Approved
phase: —
owner: PM
created: 2026-06-01
last_updated: 2026-06-05
---

# 000 — Product Vision

## 1. Problem / Frustration

For the past 1–2 years, money runs out before the next payday, and the only way
to survive becomes a payday loan (*pinjol*). The root cause isn't that recording
is tedious — it's the absence of **forward visibility**. Small expenses are
forgotten, and obligations incurred now (credit-card purchases, paylater,
installments) land in _future_ months invisibly. By mid-cycle the balance is
mysteriously low, and it's too late to adjust.

## 2. Vision

A personal **cash-flow forecaster** that answers one question at a glance, from a
phone: **"How much can I safely spend before my next paycheck?"** It reconciles
projected income against every known and planned obligation across all wallets —
and because the **payment method determines which cycle an expense actually lands
in**, it surfaces the squeeze _before_ it happens, not after.

## 3. The model (the spine)

- **Time is the backbone.** Money lives on payday **cycles**, anchored to the
  user's primary recurring income. The anchor is data-driven: change the income's
  date and the cycle follows — no code change.
- **Money has two states:** _committed-but-unpaid_ (recurring obligations,
  credit-card/paylater bills, future plans) and _actually-moved_ (cash spent now,
  executed plans). The **payment method decides when** a movement crosses from the
  first state to the second.
- **Wallets hold real money** (cash, debit, e-wallet); their balances are
  **pooled** into one total-liquidity figure. **Credit card and paylater are NOT
  wallets** — they generate future obligations that are paid _from_ a wallet at
  the due date.
- **The home screen, in one line:** _You hold **X** now → **Y** of obligations are
  due this cycle → **Z** is safe to spend._ A per-wallet breakdown sits beneath it.

## 4. Who it's for

- **Now:** the author — frictionless, forward-looking control of personal cash flow.
- **Later (Release v0.0.1+):** friends — multi-user and data isolation are designed
  in from day one (every record owned by a `userId`).

## 5. Goals (product-level)

- Know "safe to spend until next payday" instantly, without manual math.
- Never be ambushed by a credit-card bill or a due date.
- Capture stays fast — but now records _payment method_ and _when the money
  actually hits_.
- See the projected position of upcoming cycles, so a future crunch is visible early.
- Grow feature-by-feature without rewrites — each feature isolated and documented.

## 6. Non-goals (for now)

- Bank/account auto-sync or open-banking integrations.
- Receipt OCR — revisited once the core loop is solid (nice-to-have, not foundational).
- Investments, multi-currency portfolios, tax reporting.
- Team/organization accounts, sharing, or collaboration.
- A native mobile app (responsive web first).

## 7. Principles

1. **Forward visibility beats record-keeping.** The core loop is
   _forecast → capture → reconcile_, not merely record → see.
2. **Speed of capture beats feature richness.** Logging a movement must stay
   faster than a spreadsheet.
3. **Docs-first.** Every feature has a PRD and an RFC; the RFC stays accurate.
4. **Incremental & isolated.** Domain-modular code; new features don't disturb old ones.
5. **YAGNI.** Build the smallest valuable slice; defer the rest to a later phase.

## 8. Success metric

The author stops relying on _pinjol_ to finish the month — because the app surfaces
the cash crunch early enough to adjust — and checks "safe to spend" daily through
the MVP. Later, at least a couple of friends try it after Release v0.0.1.

## 9. Phasing

See [`../roadmap.md`](../roadmap.md). MVP = a trustworthy "safe to spend this
cycle" number: wallets + pooled balance, income (incl. the primary recurring
anchor), payment-method-timed expenses & obligations, and the X→Y→Z home.
