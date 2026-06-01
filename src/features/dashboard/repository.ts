import { TransactionType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export function sumByType(userId: string, start: Date, end: Date) {
  return prisma.transaction.groupBy({
    by: ["type"],
    where: { userId, occurredAt: { gte: start, lt: end } },
    _sum: { amount: true },
  });
}

export function sumExpenseByCategory(userId: string, start: Date, end: Date) {
  return prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId,
      type: TransactionType.EXPENSE,
      occurredAt: { gte: start, lt: end },
    },
    _sum: { amount: true },
  });
}

export function categoriesByIds(userId: string, ids: string[]) {
  return prisma.category.findMany({ where: { userId, id: { in: ids } } });
}
