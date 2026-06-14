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
import { MovementStatus, MovementType } from "@/generated/prisma/enums";
import { cycleOf, getCycleByOffset, toCycleDate } from "@/lib/cycle";
import { DomainError } from "@/lib/errors";
import type {
  ConfirmIncomeInput,
  ConfirmRecurringIncomeInput,
  OneOffIncomeInput,
  PrimaryIncomeInput,
  RecurringIncomeInput,
  UpdateIncomeInput,
} from "./schema";
import type { IncomeItem, IncomeView } from "./types";

/**
 * Income & payday cycle (RFC 0007). Pure orchestration over the spine
 * (`recurring` + `movements` + `cycle`); it owns no table. The primary recurring
 * income anchors the cycle; other income lifts a cycle's picture.
 */

export async function getCycleWindow(
  userId: string,
  offset = 0,
  now: Date = new Date(),
) {
  const primary = await recurringRepo.findPrimaryIncome(userId);
  const anchorDay = primary?.dayOfMonth ?? 1;
  return {
    cycle: getCycleByOffset(anchorDay, now, offset),
    hasPrimaryIncome: primary !== null,
  };
}

/** Set or edit the one primary recurring income (the cycle anchor). */
export async function setPrimaryIncome(
  userId: string,
  input: PrimaryIncomeInput,
) {
  const fields = {
    amount: input.amount,
    dayOfMonth: input.dayOfMonth,
    walletId: input.walletId,
    categoryId: input.categoryId ?? null,
    note: input.note ?? null,
  };
  const existing = await recurringRepo.findPrimaryIncome(userId);
  if (existing) {
    return updateRule(existing.id, userId, fields);
  }
  return createRule({
    userId,
    type: MovementType.INCOME,
    isPrimaryIncome: true,
    startsOn: toCycleDate(new Date()),
    ...fields,
  });
}

export function addRecurringIncome(
  userId: string,
  input: RecurringIncomeInput,
) {
  return createRule({
    userId,
    type: MovementType.INCOME,
    isPrimaryIncome: false,
    startsOn: toCycleDate(new Date()),
    amount: input.amount,
    dayOfMonth: input.dayOfMonth,
    walletId: input.walletId,
    categoryId: input.categoryId ?? null,
    note: input.note ?? null,
  });
}

export function updateRecurringIncome(
  userId: string,
  ruleId: string,
  input: RecurringIncomeInput,
) {
  return updateRule(ruleId, userId, {
    amount: input.amount,
    dayOfMonth: input.dayOfMonth,
    walletId: input.walletId,
    categoryId: input.categoryId ?? null,
    note: input.note ?? null,
  });
}

export function endRecurringIncome(userId: string, ruleId: string) {
  return endRule(ruleId, userId);
}

/** One-off income — received now (ACTUAL) or expected later (PLANNED). */
export function addOneOffIncome(userId: string, input: OneOffIncomeInput) {
  const now = new Date();
  return createMovement({
    userId,
    type: MovementType.INCOME,
    status: input.received ? MovementStatus.ACTUAL : MovementStatus.PLANNED,
    amount: input.amount,
    walletId: input.walletId,
    categoryId: input.categoryId ?? null,
    paymentMethod: null,
    occurredAt: now,
    effectiveDate: toCycleDate(input.date),
    confirmedAt: input.received ? now : null,
    note: input.note ?? null,
  });
}

// A one-off income editable/deletable here = an INCOME, not linked to a recurring
// rule, and still PLANNED (expected). Once received (ACTUAL) it's locked.
function editableOneOff(
  movement: Awaited<ReturnType<typeof movementsRepo.findById>>,
) {
  return (
    !!movement &&
    movement.type === MovementType.INCOME &&
    movement.recurringRuleId === null &&
    movement.status === MovementStatus.PLANNED
  );
}

/**
 * Edit a one-off, not-yet-received income movement (an expected one-off).
 * Recurring occurrences are managed via their rule.
 */
export async function updateIncome(userId: string, input: UpdateIncomeInput) {
  const movement = await movementsRepo.findById(input.movementId, userId);
  if (!editableOneOff(movement)) {
    throw new DomainError("Pemasukan ini tidak bisa diubah.");
  }
  await updateMovement(input.movementId, userId, {
    amount: input.amount,
    categoryId: input.categoryId ?? null,
    note: input.note ?? null,
    effectiveDate: toCycleDate(input.date),
  });
}

/** Delete a one-off, not-yet-received income movement. */
export async function deleteIncome(userId: string, movementId: string) {
  const movement = await movementsRepo.findById(movementId, userId);
  if (!editableOneOff(movement)) {
    throw new DomainError("Pemasukan ini tidak bisa dihapus.");
  }
  await deleteMovement(movementId, userId);
}

/**
 * A movement / occurrence can only be confirmed once we've reached its cycle.
 * Confirming a *future* cycle's income flips it to ACTUAL with a future date, and
 * `deriveBalance` sums all ACTUAL regardless of date — so it would wrongly inflate
 * today's balance. You receive income when its cycle arrives, not before.
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
      "Belum bisa diterima — pemasukan ini ada di siklus mendatang. Terima nanti pas siklusnya jalan.",
    );
  }
}

/** Confirm an expected one-off income (PLANNED → ACTUAL). */
export async function confirmIncome(
  userId: string,
  input: ConfirmIncomeInput,
  now: Date = new Date(),
) {
  const movement = await movementsRepo.findById(input.movementId, userId);
  if (!movement) {
    throw new DomainError("Pemasukan sudah dikonfirmasi atau tidak ditemukan.");
  }
  await assertCycleReached(userId, movement.effectiveDate, now);
  const res = await confirmMovement(input.movementId, userId, {
    amount: input.amount,
    walletId: input.walletId,
    effectiveDate: input.date ? toCycleDate(input.date) : undefined,
  });
  // updateMany matched nothing → already confirmed or not found. Don't report
  // a phantom success.
  if (res.count === 0) {
    throw new DomainError("Pemasukan sudah dikonfirmasi atau tidak ditemukan.");
  }
}

/**
 * Confirm a projected recurring income: there's no row yet, so materialize one
 * (ACTUAL, linked to its rule) — which also stops it being re-projected.
 */
export async function confirmRecurringIncome(
  userId: string,
  input: ConfirmRecurringIncomeInput,
  now: Date = new Date(),
) {
  const rule = await recurringRepo.findById(input.ruleId, userId);
  if (!rule || rule.type !== MovementType.INCOME) {
    throw new DomainError("Pemasukan rutin tidak ditemukan.");
  }
  const effectiveDate = toCycleDate(input.occurrenceDate);
  await assertCycleReached(userId, effectiveDate, now);
  // Idempotency: a projected occurrence is materialized at most once per cycle —
  // guards against a double-confirm creating two ACTUAL rows for the same date.
  const existing = await movementsRepo.findByRuleOnDate(
    userId,
    rule.id,
    effectiveDate,
  );
  if (existing) {
    throw new DomainError("Pemasukan rutin ini sudah dikonfirmasi.");
  }
  return createMovement({
    userId,
    type: MovementType.INCOME,
    status: MovementStatus.ACTUAL,
    amount: input.amount ?? Number(rule.amount),
    walletId: input.walletId ?? rule.walletId,
    categoryId: rule.categoryId,
    paymentMethod: null,
    occurredAt: now,
    effectiveDate,
    recurringRuleId: rule.id,
    confirmedAt: now,
  });
}

/** The income picture for a cycle: sources + this cycle's received/expected/projected. */
export async function listIncome(
  userId: string,
  offset = 0,
  now: Date = new Date(),
): Promise<IncomeView> {
  // One read of the primary income gives both the cycle anchor and hasPrimary.
  const primary = await recurringRepo.findPrimaryIncome(userId);
  const anchorDay = primary?.dayOfMonth ?? 1;
  const cycle = getCycleByOffset(anchorDay, now, offset);

  const [windowMovements, rules] = await Promise.all([
    movementsRepo.listByUserInWindow(userId, cycle.start, cycle.end),
    listActiveRules(userId),
  ]);

  const incomeMovements = windowMovements.filter(
    (m) => m.type === MovementType.INCOME,
  );
  const incomeRules = rules.filter((r) => r.type === MovementType.INCOME);

  const materializedRuleIds = new Set(
    incomeMovements
      .map((m) => m.recurringRuleId)
      .filter((id): id is string => id !== null),
  );
  const projected = projectOccurrences(
    incomeRules.map(toProjectionRule),
    cycle,
    materializedRuleIds,
  );

  const items: IncomeItem[] = [
    ...incomeMovements.map((m) => ({
      kind:
        m.status === MovementStatus.ACTUAL
          ? ("received" as const)
          : ("expected" as const),
      movementId: m.id,
      ruleId: m.recurringRuleId,
      amount: Number(m.amount),
      walletId: m.walletId,
      categoryId: m.categoryId,
      effectiveDate: m.effectiveDate,
      note: m.note,
    })),
    ...projected.map((p) => ({
      kind: "projected" as const,
      movementId: null,
      ruleId: p.ruleId,
      amount: p.amount,
      walletId: p.walletId,
      categoryId: p.categoryId,
      effectiveDate: p.effectiveDate,
      note: p.note, // the rule's note — distinguishes same-tag recurring sources
    })),
  ].sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());

  return {
    cycle,
    hasPrimaryIncome: primary !== null,
    primary,
    recurringSources: incomeRules.filter((r) => !r.isPrimaryIncome),
    items,
  };
}
