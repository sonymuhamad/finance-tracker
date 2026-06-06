import { MovementStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { MovementInput } from "./types";

/** The ONLY layer that touches Prisma for movements (RFC 0005). */

export function create(data: MovementInput) {
  return prisma.movement.create({ data });
}

// deriveBalance only reads type/status/amount — select just those to keep the
// hot balance path off the full row.
const balanceSelect = { type: true, status: true, amount: true } as const;

/** A wallet's actual movements — the inputs to its derived balance. */
export function listActualByWallet(userId: string, walletId: string) {
  return prisma.movement.findMany({
    where: { userId, walletId, status: MovementStatus.ACTUAL },
    select: balanceSelect,
  });
}

/** All of a user's actual movements (for the pooled balance). */
export function listActualByUser(userId: string) {
  return prisma.movement.findMany({
    where: { userId, status: MovementStatus.ACTUAL },
    select: balanceSelect,
  });
}

/** Movements whose effective date falls in [start, end] — the cycle window. */
export function listByUserInWindow(userId: string, start: Date, end: Date) {
  return prisma.movement.findMany({
    where: { userId, effectiveDate: { gte: start, lte: end } },
    orderBy: { effectiveDate: "asc" },
  });
}

export function findById(id: string, userId: string) {
  return prisma.movement.findFirst({ where: { id, userId } });
}

/** Flip a planned movement to actual. Scoped so a user only confirms their own. */
export function confirm(
  id: string,
  userId: string,
  data: {
    confirmedAt: Date;
    walletId?: string;
    amount?: number;
    effectiveDate?: Date;
  },
) {
  return prisma.movement.updateMany({
    where: { id, userId, status: MovementStatus.PLANNED },
    data: { status: MovementStatus.ACTUAL, ...data },
  });
}

export function remove(id: string, userId: string) {
  return prisma.movement.deleteMany({ where: { id, userId } });
}
