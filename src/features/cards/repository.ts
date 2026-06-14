import type { CardKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/** The ONLY layer that touches Prisma for cards (RFC 0008). */

type CardData = {
  name: string;
  kind: CardKind;
  defaultDueDay: number;
  payingWalletId: string;
};

export function listActive(userId: string) {
  return prisma.card.findMany({
    where: { userId, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

export function findById(id: string, userId: string) {
  return prisma.card.findFirst({ where: { id, userId } });
}

export function create(userId: string, data: CardData) {
  return prisma.card.create({ data: { userId, ...data } });
}

export function update(id: string, userId: string, data: CardData) {
  return prisma.card.updateMany({ where: { id, userId }, data });
}

export function archive(id: string, userId: string, archivedAt: Date) {
  return prisma.card.updateMany({
    where: { id, userId },
    data: { archivedAt },
  });
}

export function remove(id: string, userId: string) {
  return prisma.card.deleteMany({ where: { id, userId } });
}
