import * as cardsRepo from "@/features/cards/repository";
import { resolveTiming } from "@/features/movements/balance";
import * as movementsRepo from "@/features/movements/repository";
import {
  confirmMovement,
  createMovement,
  deleteMovement,
  updateMovement,
} from "@/features/movements/service";
import {
  projectOccurrences,
  toProjectionRule,
} from "@/features/recurring/projection";
import * as recurringRepo from "@/features/recurring/repository";
import {
  createRule,
  endRule,
  listActiveRules,
  updateRule,
} from "@/features/recurring/service";
import {
  MovementStatus,
  MovementType,
  PaymentMethod,
} from "@/generated/prisma/enums";
import {
  cycleOf,
  getCycleByOffset,
  getCycleRange,
  toCycleDate,
} from "@/lib/cycle";
import { DomainError } from "@/lib/errors";
import { roundMoney } from "@/lib/money";
import type {
  AdjustOccurrenceInput,
  ConfirmObligationInput,
  ConfirmRecurringObligationInput,
  ExpenseInput,
  OccurrenceInput,
  RecurringObligationInput,
  UpdateExpenseInput,
} from "./schema";
import { nextDueDate } from "./timing";
import type { ExpenseItem, ExpenseSummary, ExpenseView } from "./types";

/**
 * Expenses & obligations (RFC 0008). Orchestration over `movements` + `cards` +
 * `recurring` + `cycle` (owns no table). The payment method decides timing: cash
 * hits now; CC/paylater create an obligation due on the card's due date.
 */

/** Record a one-off expense; the method decides when it hits which cycle. */
export async function recordExpense(
  userId: string,
  input: ExpenseInput,
  now: Date = new Date(),
) {
  if (input.method === PaymentMethod.CASH) {
    const effectiveDate = toCycleDate(input.date);
    // Paid now → ACTUAL (deducts immediately). Marked "belum dibayar / rencana"
    // (paid === false) → PLANNED (polish backlog #6). Also force PLANNED for a
    // *future-cycle* date even if marked paid: you can't have already-paid cash for
    // a cycle that hasn't started, and a future-dated ACTUAL would wrongly cut
    // today's balance (deriveBalance sums all ACTUAL regardless of date). Confirm
    // it once its cycle arrives.
    let planned = input.paid === false;
    if (!planned) {
      const primary = await recurringRepo.findPrimaryIncome(userId);
      const anchorDay = primary?.dayOfMonth ?? 1;
      planned = cycleOf(anchorDay, now, effectiveDate) > 0;
    }
    return createMovement({
      userId,
      type: MovementType.EXPENSE,
      status: planned ? MovementStatus.PLANNED : MovementStatus.ACTUAL,
      amount: input.amount,
      walletId: input.walletId as string, // guaranteed by the schema refine
      cardId: null,
      categoryId: input.categoryId ?? null,
      paymentMethod: PaymentMethod.CASH,
      occurredAt: input.date,
      effectiveDate,
      note: input.note ?? null,
    });
  }

  // Credit card / paylater → an obligation paid from the card's wallet on its due date.
  const card = await cardsRepo.findById(input.cardId as string, userId);
  if (!card) throw new DomainError("Kartu tidak ditemukan.");
  const dueDate = input.dueDate ?? nextDueDate(card.defaultDueDay, input.date);
  const timing = resolveTiming(input.method, input.date, dueDate);
  return createMovement({
    userId,
    type: MovementType.EXPENSE,
    status: timing.status,
    amount: input.amount,
    walletId: card.payingWalletId,
    cardId: card.id,
    categoryId: input.categoryId ?? null,
    paymentMethod: input.method,
    occurredAt: input.date,
    effectiveDate: toCycleDate(timing.effectiveDate),
    note: input.note ?? null,
  });
}

export function addRecurringObligation(
  userId: string,
  input: RecurringObligationInput,
) {
  return createRule({
    userId,
    type: MovementType.EXPENSE,
    isPrimaryIncome: false,
    startsOn: toCycleDate(new Date()),
    amount: input.amount,
    dayOfMonth: input.dayOfMonth,
    walletId: input.walletId,
    cardId: input.cardId ?? null,
    categoryId: input.categoryId ?? null,
    note: input.note ?? null,
  });
}

export function updateRecurringObligation(
  userId: string,
  ruleId: string,
  input: RecurringObligationInput,
) {
  return updateRule(ruleId, userId, {
    amount: input.amount,
    dayOfMonth: input.dayOfMonth,
    walletId: input.walletId,
    cardId: input.cardId ?? null,
    categoryId: input.categoryId ?? null,
    note: input.note ?? null,
  });
}

export function endRecurringObligation(userId: string, ruleId: string) {
  return endRule(ruleId, userId);
}

/**
 * A movement / occurrence can only be confirmed once we've reached its cycle.
 * Confirming a *future* cycle's item flips it to ACTUAL with a future date, and
 * `deriveBalance` sums all ACTUAL regardless of date — so it would wrongly deduct
 * today's balance. You pay a bill when its cycle arrives, not before.
 */
async function assertCycleReached(
  userId: string,
  effectiveDate: Date,
  now: Date,
) {
  const primary = await recurringRepo.findPrimaryIncome(userId);
  const anchorDay = primary?.dayOfMonth ?? 1;
  if (cycleOf(anchorDay, now, effectiveDate) > 0) {
    throw new DomainError(
      "Belum bisa dibayar — tagihan ini ada di siklus mendatang. Bayar nanti pas siklusnya jalan.",
    );
  }
}

/** Confirm a planned obligation paid (PLANNED → ACTUAL), deducting the wallet. */
export async function confirmObligation(
  userId: string,
  input: ConfirmObligationInput,
  now: Date = new Date(),
) {
  const movement = await movementsRepo.findById(input.movementId, userId);
  if (!movement) {
    throw new DomainError("Tagihan sudah dibayar atau tidak ditemukan.");
  }
  await assertCycleReached(userId, movement.effectiveDate, now);
  const res = await confirmMovement(input.movementId, userId, {
    amount: input.amount,
    walletId: input.walletId,
    effectiveDate: input.date ? toCycleDate(input.date) : undefined,
  });
  if (res.count === 0) {
    throw new DomainError("Tagihan sudah dibayar atau tidak ditemukan.");
  }
}

/** Confirm a projected recurring obligation: materialize it (idempotent). */
export async function confirmRecurringObligation(
  userId: string,
  input: ConfirmRecurringObligationInput,
  now: Date = new Date(),
) {
  const rule = await recurringRepo.findById(input.ruleId, userId);
  if (!rule || rule.type !== MovementType.EXPENSE) {
    throw new DomainError("Tagihan rutin tidak ditemukan.");
  }
  const effectiveDate = toCycleDate(input.occurrenceDate);
  await assertCycleReached(userId, effectiveDate, now);
  const existing = await movementsRepo.findByRuleOnDate(
    userId,
    rule.id,
    effectiveDate,
  );
  if (existing) throw new DomainError("Tagihan rutin ini sudah dibayar.");
  return createMovement({
    userId,
    type: MovementType.EXPENSE,
    status: MovementStatus.ACTUAL,
    amount: input.amount ?? Number(rule.amount),
    walletId: input.walletId ?? rule.walletId,
    cardId: rule.cardId,
    categoryId: rule.categoryId,
    // A recurring obligation is a scheduled debit from its paying wallet (not a
    // card swipe); the cardId, if any, only links grouping.
    paymentMethod: null,
    occurredAt: now,
    effectiveDate,
    recurringRuleId: rule.id,
    confirmedAt: now,
  });
}

// A one-off expense editable/deletable here = an EXPENSE, not linked to a
// recurring rule, and still PLANNED. Once paid (ACTUAL) it's locked; recurring
// occurrences are managed via the occurrence helpers below.
function editableOneOff(
  movement: Awaited<ReturnType<typeof movementsRepo.findById>>,
) {
  return (
    !!movement &&
    movement.type === MovementType.EXPENSE &&
    movement.recurringRuleId === null &&
    movement.status === MovementStatus.PLANNED
  );
}

/**
 * Edit a one-off, not-yet-paid expense movement (a planned cash expense or a card
 * obligation). The date doubles as a card obligation's due date.
 */
export async function updateExpense(userId: string, input: UpdateExpenseInput) {
  const movement = await movementsRepo.findById(input.movementId, userId);
  if (!editableOneOff(movement)) {
    throw new DomainError("Pengeluaran ini tidak bisa diubah.");
  }
  await updateMovement(input.movementId, userId, {
    amount: input.amount,
    categoryId: input.categoryId ?? null,
    note: input.note ?? null,
    effectiveDate: toCycleDate(input.date),
  });
}

/** Delete a one-off, not-yet-paid expense movement. */
export async function deleteExpense(userId: string, movementId: string) {
  const movement = await movementsRepo.findById(movementId, userId);
  if (!editableOneOff(movement)) {
    throw new DomainError("Pengeluaran ini tidak bisa dihapus.");
  }
  await deleteMovement(movementId, userId);
}

/**
 * Per-occurrence overrides on a recurring obligation (this cycle only; the rule
 * keeps running). All three materialize a `Movement` for (rule, occurrenceDate),
 * which suppresses that cycle's projection. Not cycle-guarded (planning a future
 * cycle is fine); a *paid* (ACTUAL) occurrence is locked.
 */
async function loadOccurrence(
  userId: string,
  ruleId: string,
  occurrenceDate: Date,
) {
  const rule = await recurringRepo.findById(ruleId, userId);
  if (!rule || rule.type !== MovementType.EXPENSE) {
    throw new DomainError("Tagihan rutin tidak ditemukan.");
  }
  const effectiveDate = toCycleDate(occurrenceDate);
  const existing = await movementsRepo.findByRuleOnDate(
    userId,
    ruleId,
    effectiveDate,
  );
  if (existing && existing.status === MovementStatus.ACTUAL) {
    throw new DomainError("Tagihan ini sudah dibayar — tidak bisa diubah.");
  }
  return { rule, effectiveDate, existing };
}

/** Override just this cycle's amount (materialize/keep it PLANNED). */
export async function adjustObligationOccurrence(
  userId: string,
  input: AdjustOccurrenceInput,
) {
  const { rule, effectiveDate, existing } = await loadOccurrence(
    userId,
    input.ruleId,
    input.occurrenceDate,
  );
  if (existing) {
    return updateMovement(existing.id, userId, {
      amount: input.amount,
      status: MovementStatus.PLANNED,
    });
  }
  return createMovement({
    userId,
    type: MovementType.EXPENSE,
    status: MovementStatus.PLANNED,
    amount: input.amount,
    walletId: rule.walletId,
    cardId: rule.cardId,
    categoryId: rule.categoryId,
    paymentMethod: null,
    occurredAt: new Date(),
    effectiveDate,
    recurringRuleId: rule.id,
    note: rule.note,
  });
}

/** Skip just this cycle's occurrence (materialize SKIPPED — drops out of Y). */
export async function skipObligationOccurrence(
  userId: string,
  input: OccurrenceInput,
) {
  const { rule, effectiveDate, existing } = await loadOccurrence(
    userId,
    input.ruleId,
    input.occurrenceDate,
  );
  if (existing) {
    return updateMovement(existing.id, userId, {
      status: MovementStatus.SKIPPED,
    });
  }
  return createMovement({
    userId,
    type: MovementType.EXPENSE,
    status: MovementStatus.SKIPPED,
    amount: Number(rule.amount),
    walletId: rule.walletId,
    cardId: rule.cardId,
    categoryId: rule.categoryId,
    paymentMethod: null,
    occurredAt: new Date(),
    effectiveDate,
    recurringRuleId: rule.id,
    note: rule.note,
  });
}

/** Undo an adjust/skip — delete the marker so the default projection returns. */
export async function restoreObligationOccurrence(
  userId: string,
  input: OccurrenceInput,
) {
  const { existing } = await loadOccurrence(
    userId,
    input.ruleId,
    input.occurrenceDate,
  );
  if (existing) await deleteMovement(existing.id, userId);
}

/** This cycle's expenses + obligations: paid, due (planned), projected recurring. */
/**
 * Pure: roll the cycle's items into headline totals. `paid` is money already out
 * (ACTUAL); `due` + `projected` are still upcoming (= the home's Y). `skipped`
 * doesn't count. Totals are derived from the same `items` the page lists, so the
 * headline always equals the sum of the rows below it.
 */
export function summarizeExpenseItems(items: ExpenseItem[]): ExpenseSummary {
  let spent = 0;
  let upcoming = 0;
  let count = 0;
  for (const item of items) {
    if (item.kind === "skipped") continue;
    count += 1;
    if (item.kind === "paid") spent += item.amount;
    else upcoming += item.amount;
  }
  return {
    spent: roundMoney(spent),
    upcoming: roundMoney(upcoming),
    total: roundMoney(spent + upcoming),
    count,
  };
}

export async function listExpenses(
  userId: string,
  offset = 0,
  now: Date = new Date(),
): Promise<ExpenseView> {
  const primary = await recurringRepo.findPrimaryIncome(userId);
  const anchorDay = primary?.dayOfMonth ?? 1;
  const cycle = getCycleByOffset(anchorDay, now, offset);

  const [windowMovements, rules, cards] = await Promise.all([
    movementsRepo.listByUserInWindow(userId, cycle.start, cycle.end),
    listActiveRules(userId),
    cardsRepo.listActive(userId),
  ]);

  const expenseMovements = windowMovements.filter(
    (m) => m.type === MovementType.EXPENSE,
  );
  const expenseRules = rules.filter((r) => r.type === MovementType.EXPENSE);

  const materializedRuleIds = new Set(
    expenseMovements
      .map((m) => m.recurringRuleId)
      .filter((id): id is string => id !== null),
  );
  const projected = projectOccurrences(
    expenseRules.map(toProjectionRule),
    cycle,
    materializedRuleIds,
  );

  const items: ExpenseItem[] = [
    ...expenseMovements.map((m) => ({
      kind:
        m.status === MovementStatus.ACTUAL
          ? ("paid" as const)
          : m.status === MovementStatus.SKIPPED
            ? ("skipped" as const)
            : ("due" as const),
      movementId: m.id,
      ruleId: m.recurringRuleId,
      amount: Number(m.amount),
      walletId: m.walletId,
      cardId: m.cardId,
      categoryId: m.categoryId,
      paymentMethod: m.paymentMethod,
      effectiveDate: m.effectiveDate,
      note: m.note,
    })),
    ...projected.map((p) => ({
      kind: "projected" as const,
      movementId: null,
      ruleId: p.ruleId,
      amount: p.amount,
      walletId: p.walletId,
      cardId: p.cardId,
      categoryId: p.categoryId,
      paymentMethod: null, // recurring obligation = scheduled wallet debit
      effectiveDate: p.effectiveDate,
      note: p.note, // the rule's note (e.g. "Buat Bunda" vs "Buat Ayah")
    })),
  ].sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());

  // Current + forward only — same window as the home switcher (RFC 0009); past
  // cycles are omitted (they'd need opening-balance reconstruction).
  const strip = getCycleRange(anchorDay, now, { back: 0, forward: 12 });

  return {
    cycle,
    anchorDay,
    strip,
    recurringObligations: expenseRules,
    cards,
    items,
    summary: summarizeExpenseItems(items),
  };
}
