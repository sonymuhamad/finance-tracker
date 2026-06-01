# Roadmap — finance-tracker

> Agile & incremental. New ideas get a PRD first; the PM decides which milestone
> they land in. This file is the single source of truth for phasing.

**North star:** _Recording personal finances should be fast, easy, and
phone-friendly — without the friction of a spreadsheet._

## Status legend

`◻ planned` · `▶ in progress` · `✅ done`

---

## MVP — v0.1 — the smallest loop that beats a spreadsheet

| # | Feature | PRD | Status |
|---|---|---|---|
| — | Auth foundation (Google OAuth + dev-login) | `prd/mvp/004-auth-foundation.md` | ✅ |
| a | Record transactions (income & expense) | `prd/mvp/001-record-transaction.md` | ✅ |
| b | Categories | `prd/mvp/002-categories.md` | ✅ |
| e | Dashboard / monthly summary | `prd/mvp/003-dashboard-summary.md` | ✅ |

**Done when:** Sony can log a transaction on his phone in seconds and see where
the month's money went — replacing his spreadsheet for daily use.

## Phase 1 — v0.2 — multiple wallets

| # | Feature | Notes |
|---|---|---|
| c | Multi-wallet (cash, bank, e-wallet) + per-wallet balance + transfers | Adds balance logic; own RFC. |

## Phase 2 — v0.3 — automation & limits

| # | Feature | Notes |
|---|---|---|
| f | Recurring transactions (subscriptions) | Needs a scheduler. |
| d | Budgets per category + alerts | Builds on categories + summary. |

## Release — v0.0.1 — open to friends

- Hosting (Vercel + managed Postgres — e.g. Neon/Supabase).
- Production hardening: disable dev-login, real `AUTH_SECRET`, error monitoring.
- Polish & onboarding for first external testers.

## Backlog (unscheduled)

Open list — anything captured via `/new-feature` that isn't slotted yet.

- _(empty)_
