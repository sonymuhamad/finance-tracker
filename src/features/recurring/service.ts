import type { RecurringRule } from "@/generated/prisma/client";
import type { ProjectionRule } from "./projection";
import * as repo from "./repository";
import type { RecurringRuleInput } from "./types";

/**
 * Recurring rules (RFC 0005): the source of truth for monthly repeating items.
 * Future occurrences are projected (see ./projection) rather than stored.
 */
export {
  type ProjectedOccurrence,
  type ProjectionRule,
  projectOccurrences,
} from "./projection";

/**
 * Create a rule. If it's the primary income, make it the *only* one atomically
 * (the cycle is anchored to a single primary income).
 */
export function createRule(input: RecurringRuleInput) {
  if (input.isPrimaryIncome) {
    return repo.createPrimaryIncome(input);
  }
  return repo.create({ ...input, isPrimaryIncome: false });
}

export function setPrimaryIncome(userId: string, ruleId: string) {
  return repo.setPrimaryIncome(userId, ruleId);
}

export function endRule(
  id: string,
  userId: string,
  endedAt: Date = new Date(),
) {
  return repo.end(id, userId, endedAt);
}

export function listActiveRules(userId: string) {
  return repo.listActive(userId);
}

/**
 * The day-of-month that anchors the payday cycle, or 1 (calendar months) when no
 * primary income is set yet — the fallback from PRD 006.
 */
export async function getCycleAnchorDay(userId: string): Promise<number> {
  const primary = await repo.findPrimaryIncome(userId);
  return primary?.dayOfMonth ?? 1;
}

/** Map a persisted rule to the shape the pure projection consumes. */
export function toProjectionRule(rule: RecurringRule): ProjectionRule {
  return {
    id: rule.id,
    type: rule.type,
    amount: Number(rule.amount),
    dayOfMonth: rule.dayOfMonth,
    walletId: rule.walletId,
    cardId: rule.cardId,
    categoryId: rule.categoryId,
    startsOn: rule.startsOn,
    endedAt: rule.endedAt,
  };
}
