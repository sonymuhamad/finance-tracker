import type { TransactionType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

type TransactionData = {
  type: TransactionType;
  amount: number;
  categoryId: string;
  occurredAt: Date;
  note?: string;
};

const withCategory = {
  category: { select: { id: true, name: true, color: true, icon: true } },
} as const;

export function listByUser(userId: string, limit: number) {
  return prisma.transaction.findMany({
    where: { userId },
    include: withCategory,
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}

/** Returns the category if it belongs to the user, else null. */
export function findOwnedCategory(userId: string, categoryId: string) {
  return prisma.category.findFirst({ where: { id: categoryId, userId } });
}

export function create(userId: string, data: TransactionData) {
  return prisma.transaction.create({ data: { userId, ...data } });
}

export function update(id: string, userId: string, data: TransactionData) {
  return prisma.transaction.updateMany({ where: { id, userId }, data });
}

export function remove(id: string, userId: string) {
  return prisma.transaction.deleteMany({ where: { id, userId } });
}
