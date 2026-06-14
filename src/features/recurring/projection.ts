/**
 * Recurring-rule projection (RFC 0005). Pure — no I/O.
 *
 * Future cycles are not materialized: a rule's occurrences are projected on read
 * from the rule + cycle. An occurrence is suppressed once a real Movement exists
 * for that (rule, cycle) — that's the `materializedRuleIds` set — so a confirmed
 * item is never double-counted against its still-virtual projection.
 */

import type { RecurringRule } from "@/generated/prisma/client";
import type { MovementType } from "@/generated/prisma/enums";
import { type Cycle, occurrenceDateInCycle, toCycleDate } from "@/lib/cycle";

export type ProjectionRule = {
  id: string;
  type: MovementType;
  amount: number;
  dayOfMonth: number;
  walletId: string;
  cardId: string | null;
  categoryId: string | null;
  note: string | null;
  startsOn: Date;
  endedAt: Date | null;
};

/** Map a persisted rule to the shape this pure projection consumes. */
export function toProjectionRule(rule: RecurringRule): ProjectionRule {
  return {
    id: rule.id,
    type: rule.type,
    amount: Number(rule.amount),
    dayOfMonth: rule.dayOfMonth,
    walletId: rule.walletId,
    cardId: rule.cardId,
    categoryId: rule.categoryId,
    note: rule.note,
    startsOn: rule.startsOn,
    endedAt: rule.endedAt,
  };
}

export type ProjectedOccurrence = {
  ruleId: string;
  type: MovementType;
  amount: number;
  walletId: string;
  cardId: string | null;
  categoryId: string | null;
  note: string | null; // the rule's note — same every cycle, shown to tell items apart
  effectiveDate: Date;
  cycleOffset: number;
};

/**
 * Virtual occurrences of `rules` within `cycle`, minus already-materialized ones.
 *
 * `materializedRuleIds` MUST be the rule ids that already have a Movement **in
 * this cycle's window** (not all-time) — a rule materialized in one cycle still
 * projects in every other. The caller builds it from movements whose
 * effectiveDate falls in `[cycle.start, cycle.end]`.
 */
export function projectOccurrences(
  rules: ProjectionRule[],
  cycle: Cycle,
  materializedRuleIds: Set<string>,
): ProjectedOccurrence[] {
  const occurrences: ProjectedOccurrence[] = [];
  for (const rule of rules) {
    if (materializedRuleIds.has(rule.id)) continue;

    const effectiveDate = occurrenceDateInCycle(rule.dayOfMonth, cycle);
    if (!effectiveDate) continue;
    // Normalize the rule's boundaries so a stored time-of-day can't shift the
    // comparison across a day (effectiveDate is already UTC-midnight).
    if (effectiveDate < toCycleDate(rule.startsOn)) continue; // not started yet
    if (rule.endedAt && effectiveDate >= toCycleDate(rule.endedAt)) continue; // ended

    occurrences.push({
      ruleId: rule.id,
      type: rule.type,
      amount: rule.amount,
      walletId: rule.walletId,
      cardId: rule.cardId,
      categoryId: rule.categoryId,
      note: rule.note,
      effectiveDate,
      cycleOffset: cycle.offset,
    });
  }
  return occurrences;
}
