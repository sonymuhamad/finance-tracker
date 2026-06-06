# Roadmap — finance-tracker

> Agile & incremental. New ideas get a PRD first; the PM decides which milestone
> they land in. This file is the single source of truth for phasing.

**North star:** _Recording personal finances should be fast, easy, and
phone-friendly — without the friction of a spreadsheet._

## Status legend

`◻ planned` · `▶ in progress` · `✅ done`

---

## MVP — v0.1 — a trustworthy "safe to spend this cycle"

> **Reframed (2026-06-05):** the original v0.1 (record + retrospective dashboard)
> is superseded. The product's heart is forward-looking cash flow, so the MVP is
> rebuilt around a trustworthy _"safe to spend before next payday"_ number. See
> `prd/000-product-vision.md`. Old MVP PRDs (`prd/mvp/001–003`) are being
> re-sliced; auth (`004`) carries over.

| # | Feature | Status |
|---|---|---|
| — | Auth foundation (Google OAuth + dev-login) | ✅ (salvaged from old v0.1) |
| a | Wallets + pooled balance + set primary (no transfers yet) | ◻ |
| b | Income — primary recurring (anchors cycle) + one-off + forward income (set future cycles) | ◻ |
| c | Expenses & obligations with payment-method timing (cash now · CC/paylater on due date · recurring fixed e.g. cicilan/SPP) | ◻ |
| d | Categories / tags (adapted from old v0.1) | ◻ |
| e | Home — "X now → Y due this cycle → Z safe to spend" + per-wallet breakdown | ◻ |
| f | Multi-cycle view — cycle switcher on the home to view/project the current → future cycles | ◻ |

**Done when:** Sony opens the app on his phone and instantly trusts the "safe to
spend before next payday" number — because it already accounts for his cash, his
upcoming credit-card bills, and his fixed obligations — and he can look ahead to
future cycles.

## Phase 1 — v0.2 — plan execution & richer recurring

| # | Feature | Notes |
|---|---|---|
| g | Plan → execute (mark a planned obligation paid → auto-records as actual) | Closes the plan/actual loop; MVP confirms receipts manually. |
| h | Richer recurring engine | Flexible schedules (bi-weekly, end dates), bulk edits. |

## Phase 2 — v0.3 — wallet mechanics

| # | Feature | Notes |
|---|---|---|
| i | Transfers between wallets + optional admin fee | Fee becomes an expense movement. |
| j | Rebalance nudge | "Total is fine, but BCA is short for the bill due Friday." |

## Phase 3 — v0.4 — depth & ease

| # | Feature | Notes |
|---|---|---|
| k | Line-item detail per transaction | "Cash: groceries; CC: Tokopedia order." |
| l | Income suggestions from history | "Set 14jt as income for the next 6 months?" |
| m | Budgets / limits per category + alerts | Builds on categories + the cycle view. |

## Release — v0.0.1 — open to friends

- Hosting (Vercel + managed Postgres — e.g. Neon/Supabase).
- Production hardening: disable dev-login, real `AUTH_SECRET`, error monitoring.
- Polish & onboarding for first external testers.

## Nice-to-have (unscheduled)

- Receipt OCR (open-source model) — capture an expense by photographing a receipt.

## Backlog (unscheduled)

- _(empty)_
