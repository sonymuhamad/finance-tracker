---
id: "005"
title: Wallets & balance
status: Approved
phase: MVP
owner: PM
created: 2026-06-05
last_updated: 2026-06-06
rfc: "0005"
---

# 005 — Wallets & balance

## 1. Problem / Frustration

The user's money isn't in one place — it's spread across cash, a bank account
(BCA), and an e-wallet (GoPay). Without a single picture of "how much do I
actually have right now", every other number is guesswork. This figure is
**X — "Punya sekarang"** on the home screen: the foundation the whole "safe to
spend" calculation stands on. If the wallets and balances aren't trustworthy, the
forecast is worthless.

> Per the vision, **wallets hold real money** and their balances are **pooled**
> into one total-liquidity figure. **Credit card and paylater are NOT wallets** —
> they are obligation instruments handled in `007` (expenses & obligations).

## 2. Goals

- The user can register their real wallets and the money currently in each.
- One wallet is marked **primary** (the financial hub — e.g. where salary lands).
- The app always shows a trustworthy **pooled total** across all wallets (= X).
- A per-wallet breakdown is visible so the user keeps per-pocket awareness.

## 3. Non-goals

- **Transfers between wallets** + admin fees → Phase 2 (v0.3, feature `i`).
- **Rebalance nudges** ("total is fine but BCA is short") → Phase 2 (`j`).
- Credit card / paylater modeled as wallets — they generate obligations (`007`).
- Bank auto-sync / open-banking, reconciliation against real statements (never).
- Multi-currency. IDR only.

## 4. User stories

- As a user, I add my wallets (Cash, BCA, GoPay) with the balance each holds now,
  so the app reflects my real money.
- As a user, I mark one wallet as **primary**, so the app knows my hub (and can
  anchor defaults later).
- As a user, I see my **total across all wallets** at a glance — my "punya
  sekarang".
- As a user, I rename, adjust, or archive a wallet when things change.

## 5. Scope (this phase)

- CRUD a wallet: **name**, **type** (`cash` | `bank` | `e-wallet`), **current
  balance** (defaults to `0`, set at creation), optional **emoji/color**.
- On first run, seed a default **Cash** wallet (balance `0`) and mark it primary,
  so the user is never empty; onboarding nudges adding their bank / e-wallet.
- Exactly **one primary** wallet at all times; the user can change which.
- Manual balance correction is allowed, recorded as an explicit **adjustment**
  entry so history stays reconcilable.
- **Pooled total** of active wallets, surfaced as X on the home screen, with a
  per-wallet breakdown.
- Balance stays accurate as movements are recorded (movements land in `007`; this
  PRD owns the wallet + its balance, not the movements).
- Every wallet owned by an authenticated `userId`.
- **Delete guard:** a wallet with recorded movements is **archived**, not
  hard-deleted (keeps history intact); a fresh wallet can be deleted outright.
- Mobile-first, matches the approved hero mockup (`docs/mockups/`).

## 6. Success metric

A new user finishes wallet setup in under a minute, and the pooled total matches
what they actually have — so they trust "Punya sekarang" on the home screen from
day one.

## 7. Decisions (resolved 2026-06-05)

- **Balance model:** seed a starting balance at creation (default `0`); current
  balance is derived as `starting balance + actual movements`. RFC owns the
  mechanics.
- **Onboarding:** first run seeds a default **Cash** wallet (balance `0`,
  primary), then nudges the user to add their bank / e-wallet.
- **Manual correction:** allowed, recorded as an explicit **adjustment** entry.
- **Negative balance:** not specially handled in MVP (allowed, no flag) — revisit
  later if it matters.
- _Left to RFC:_ exactly how the derived balance and the adjustment entry are
  represented (ties into the movement model in `007`).
