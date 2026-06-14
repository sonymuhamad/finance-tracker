import { prisma } from "@/lib/prisma";
import type { RecurringRuleInput, RecurringRuleUpdate } from "./types";

/** The ONLY layer that touches Prisma for recurring rules (RFC 0005). */

export function create(data: RecurringRuleInput) {
  return prisma.recurringRule.create({ data });
}

/** Edit a rule's mutable fields, scoped by userId (RFC 0007). */
export function update(id: string, userId: string, data: RecurringRuleUpdate) {
  return prisma.recurringRule.updateMany({ where: { id, userId }, data });
}

/**
 * Create a rule as the user's only primary income, atomically — unset any
 * current primary and insert the new one already marked primary (one round-trip,
 * no window where it exists as non-primary). The singleton guard (RFC 0005).
 */
export function createPrimaryIncome(data: RecurringRuleInput) {
  return prisma.$transaction(async (tx) => {
    await tx.recurringRule.updateMany({
      where: { userId: data.userId, isPrimaryIncome: true, endedAt: null },
      data: { isPrimaryIncome: false },
    });
    return tx.recurringRule.create({
      data: { ...data, isPrimaryIncome: true },
    });
  });
}

/** A user's active rules (not ended) — the source for projection + the anchor. */
export function listActive(userId: string) {
  return prisma.recurringRule.findMany({ where: { userId, endedAt: null } });
}

export function findById(id: string, userId: string) {
  return prisma.recurringRule.findFirst({ where: { id, userId } });
}

/** The active primary income, whose day-of-month anchors the payday cycle. */
export function findPrimaryIncome(userId: string) {
  return prisma.recurringRule.findFirst({
    where: { userId, isPrimaryIncome: true, endedAt: null },
  });
}

/** Stop a rule from a date forward (edits never touch the past). */
export function end(id: string, userId: string, endedAt: Date) {
  return prisma.recurringRule.updateMany({
    where: { id, userId },
    data: { endedAt },
  });
}

/**
 * Make `ruleId` the user's only primary income, atomically — unset any current
 * primary, then set this one. This is the singleton guard (RFC 0005).
 */
export function setPrimaryIncome(userId: string, ruleId: string) {
  return prisma.$transaction([
    prisma.recurringRule.updateMany({
      where: { userId, isPrimaryIncome: true, endedAt: null },
      data: { isPrimaryIncome: false },
    }),
    prisma.recurringRule.updateMany({
      where: { id: ruleId, userId },
      data: { isPrimaryIncome: true },
    }),
  ]);
}
