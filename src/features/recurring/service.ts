import { DomainError } from "@/lib/errors";
import * as repo from "./repository";
import type { RecurringRuleInput, RecurringRuleUpdate } from "./types";

/**
 * Recurring rules (RFC 0005): the source of truth for monthly repeating items.
 * Future occurrences are projected (see ./projection) rather than stored.
 */
export {
  type ProjectedOccurrence,
  type ProjectionRule,
  projectOccurrences,
  toProjectionRule,
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

/** Edit a rule in place (RFC 0007); changes apply to current + future cycles. */
export async function updateRule(
  id: string,
  userId: string,
  data: RecurringRuleUpdate,
) {
  const res = await repo.update(id, userId, data);
  if (res.count === 0) throw new DomainError("Aturan tidak ditemukan.");
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
