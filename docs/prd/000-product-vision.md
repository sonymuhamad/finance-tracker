---
id: "000"
title: Product Vision
status: Approved
phase: —
owner: PM
created: 2026-06-01
last_updated: 2026-06-01
---

# 000 — Product Vision

## 1. Problem / Frustration

Tracking personal money today means a spreadsheet, and spreadsheets are too
fiddly: slow to open on a phone, easy to mis-key, and they don't answer the one
question that matters — _"where did my money go this month?"_ — without manual
formula work. The result: tracking gets abandoned.

## 2. Vision

A personal finance tracker that makes **recording a transaction take seconds,
from a phone**, and turns those records into an at-a-glance picture of spending.
Built for one person first (the author), then opened to friends.

## 3. Who it's for

- **Now:** the author — a single user who wants frictionless personal tracking.
- **Later (Release v0.0.1+):** friends — hence multi-user, accounts, and data
  isolation are designed in from day one (every record is owned by a `userId`).

## 4. Goals (product-level)

- Logging a transaction is faster than opening a spreadsheet.
- The dashboard answers "where did the money go?" without any setup.
- The app is genuinely usable on a phone (responsive; PWA-friendly later).
- Grows feature-by-feature without rewrites — each feature isolated and documented.

## 5. Non-goals (for now)

- Bank/account auto-sync or open-banking integrations.
- Investments, multi-currency portfolios, tax reporting.
- Team/organization accounts, sharing, or collaboration.
- A native mobile app (responsive web first).

## 6. Principles

1. **Speed of capture beats feature richness.** The core loop is record → see.
2. **Docs-first.** Every feature has a PRD and an RFC; the RFC stays accurate.
3. **Incremental & isolated.** Domain-modular code; new features don't disturb old ones.
4. **YAGNI.** Build the smallest valuable slice; defer the rest to a later phase.

## 7. Success metric

The author replaces his spreadsheet and keeps using the app daily through the
MVP — then at least a couple of friends try it after Release v0.0.1.

## 8. Phasing

See [`../roadmap.md`](../roadmap.md). MVP = auth + record transaction +
categories + dashboard summary.
