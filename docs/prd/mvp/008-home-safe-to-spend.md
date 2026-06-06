---
id: "008"
title: Home — safe to spend
status: Approved
phase: MVP
owner: PM
created: 2026-06-05
last_updated: 2026-06-06
rfc: "0005"
---

# 008 — Home — safe to spend

## 1. Problem / Frustration

Recording is pointless if the user can't read the answer instantly. The one
question — **"how much can I safely spend before my next paycheck?"** — must be
answered at a glance, for this cycle _and_ projected forward, so a crunch is
visible early instead of as a mid-month shock. This is the screen the user opens
daily; it is the product's face. It must turn the data from `005`–`007` into the
**X − Y = Z** picture from the approved mockup.

> This PRD owns the home view **and the cycle switcher** (multi-cycle, now MVP).
> It reads from wallets (`005`), income & cycle (`006`), expenses & obligations
> (`007`) — it computes and displays, it doesn't own the data.

## 2. Goals

- Show the selected cycle's **Z "aman dipakai"** as the hero, derived from X − Y.
- Make the breakdown legible: **X (punya sekarang)** pooled + per-wallet, and
  **Y (bakal keluar)** with its obligation list.
- Let the user **switch cycles** to see the current cycle and **project forward**.
- Surface what **needs confirming** (income received / obligations to pay).

## 3. Non-goals

- **Spending-by-category analytics / charts** → later. The home is about cash
  flow, not analytics.
- **Custom date ranges**, year-over-year, export → not MVP.
- Editing records inline — the home links out to capture / detail.
- Deep historical browsing — MVP is current + forward (recent past read-only is OK).
- Budgets / limits → Phase 3 (`m`).

## 4. User stories

- As a user, I open the app and instantly see **"aman dipakai"** for this cycle.
- As a user, I see how it breaks down: what I have (X, per wallet) **minus** what's
  due (Y, per obligation).
- As a user, I **switch to a future cycle** and see its projected "aman dipakai",
  so I can spot a crunch ahead.
- As a user, I see a clear **"perlu konfirmasi"** prompt for income that landed or
  bills due, and confirm in one tap.
- As a user, I tap **＋** to record, or tap an obligation to confirm it.

## 5. Scope (this phase)

- **Hero:** Z = X − Y for the selected cycle, with `X − Y =` visible and the cycle
  window labeled (e.g. "25 Mei – 24 Jun"). A calm, reassuring treatment (per the
  approved mockup), plus a per-day allowance microcopy (`Z ÷ days left`).
- **X (punya sekarang):** pooled balance + per-wallet breakdown.
- **Y (bakal keluar):** total + a grouped obligation list for the cycle (CC grouped
  per card, recurring, paylater) with due dates and "due soon" emphasis.
- **Cycle switcher:** select the current or a future cycle; the view recomputes.
- **Forward projection:** for a future cycle, the opening balance =
  today's pooled balance + net of all movements (income + obligations) between now
  and that cycle's start; then Z = projected opening + that cycle's income − that
  cycle's obligations.
- **"Perlu konfirmasi" section:** income to confirm received + obligations due to
  confirm paid (the in-app reminders from `006`/`007`), one-tap each.
- Quick **＋ capture** entry point.
- Mobile-first, matches `docs/mockups/mvp-hero-screens.html`.

## 6. Success metric

The user opens the app and within seconds knows their safe-to-spend for this cycle
— and, by switching forward, whether an upcoming cycle looks tight. It becomes the
daily check that replaces the spreadsheet and heads off the pinjol moment.

## 7. Decisions (resolved 2026-06-06)

- **Future-cycle Z semantics:** ✅ Projection = _projected opening balance + that
  cycle's income − that cycle's obligations_ (as defined in §5).
- **Cycle range:** ✅ Cap at **12 cycles forward**; recent past is read-only.
- **Per-day allowance:** ✅ **Keep** in MVP (`Z ÷ days left`) — cheap, reassuring,
  on-brand, and already in the approved mockup.
- **Current-cycle "have now" vs projected:** ✅ For the current cycle X is the real
  pooled balance; future cycles are **labeled "proyeksi"** to surface that X (and
  therefore Z) is projected, not actual.

_Left to RFC:_ where the cycle/projection math lives (a service reused across
home + future cycles) and how recompute stays fast.