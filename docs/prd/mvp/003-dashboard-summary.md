---
id: "003"
title: Dashboard / monthly summary
status: Implemented
phase: MVP
owner: PM
created: 2026-06-01
last_updated: 2026-06-01
rfc: ../../rfc/0003-dashboard-summary.md
---

# 003 — Dashboard / monthly summary

## 1. Problem / Frustration

Recording data is pointless if the user can't read it back easily. The
spreadsheet's weakness is exactly this: answering "where did my money go this
month?" takes manual work. The dashboard must answer it instantly.

## 2. Goals

- See this month's totals: income, expense, net.
- See spending broken down by category.
- Switch the month being viewed.

## 3. Non-goals

- Custom date ranges, year-over-year, forecasting.
- Exporting (CSV/PDF).
- Budget tracking (Phase 2, feature `d`).

## 4. User stories

- As a user, I open the app and immediately see this month's income/expense/net.
- As a user, I see which categories I spent the most on.
- As a user, I look at a previous month.

## 5. Scope (this phase)

- Monthly summary cards (income, expense, net).
- Spending-by-category breakdown (list and/or simple chart).
- Month switcher (default: current month).

## 6. Success metric

Within seconds of opening the app, the user can answer "where did my money go
this month?" — no setup, no manual math.

## 7. Open questions

- Chart vs ranked list for the category breakdown (decide in RFC/UI).
- Timezone handling for "this month" boundaries.
