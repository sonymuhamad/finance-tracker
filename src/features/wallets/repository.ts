import type { WalletType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/** The ONLY layer that touches Prisma for wallets (RFC 0006). */

type WalletData = {
  name: string;
  type: WalletType;
  startingBalance?: number;
  emoji?: string;
  color?: string;
};

/** Active (non-archived) wallets, primary first then oldest. */
export function listActive(userId: string) {
  return prisma.wallet.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
}

/** Archived wallets — kept for history, excluded from the pool. */
export function listArchived(userId: string) {
  return prisma.wallet.findMany({
    where: { userId, archivedAt: { not: null } },
    orderBy: { archivedAt: "desc" },
  });
}

export function findById(id: string, userId: string) {
  return prisma.wallet.findFirst({ where: { id, userId } });
}

/** The active primary wallet (the hub), or null. */
export function findPrimary(userId: string) {
  return prisma.wallet.findFirst({
    where: { userId, isPrimary: true, archivedAt: null },
  });
}

export function countByUser(userId: string) {
  return prisma.wallet.count({ where: { userId } });
}

export function create(userId: string, data: WalletData) {
  return prisma.wallet.create({ data: { userId, ...data } });
}

/**
 * Create a wallet as the user's only primary, atomically — unset any current
 * active primary, then insert the new one already marked primary. The singleton
 * guard (RFC 0006), mirroring recurring's primary-income pattern.
 */
export function createPrimary(userId: string, data: WalletData) {
  return prisma.$transaction(async (tx) => {
    await tx.wallet.updateMany({
      where: { userId, isPrimary: true, archivedAt: null },
      data: { isPrimary: false },
    });
    return tx.wallet.create({
      data: { userId, ...data, isPrimary: true },
    });
  });
}

/** Name/type/emoji/color only — never the starting balance (use an adjustment). */
export function update(
  id: string,
  userId: string,
  data: Omit<WalletData, "startingBalance">,
) {
  return prisma.wallet.updateMany({ where: { id, userId }, data });
}

/**
 * Make `id` the user's only primary, atomically — unset the current active
 * primary, then set this one (must be active). Picking a new primary demotes the
 * old one in one transaction; there is no "remove primary" path (RFC 0006).
 */
export function setPrimary(userId: string, id: string) {
  return prisma.$transaction([
    prisma.wallet.updateMany({
      where: { userId, isPrimary: true, archivedAt: null },
      data: { isPrimary: false },
    }),
    prisma.wallet.updateMany({
      where: { id, userId, archivedAt: null },
      data: { isPrimary: true },
    }),
  ]);
}

export function archive(id: string, userId: string, archivedAt: Date) {
  return prisma.wallet.updateMany({
    where: { id, userId },
    data: { archivedAt },
  });
}

export function restore(id: string, userId: string) {
  return prisma.wallet.updateMany({
    where: { id, userId },
    data: { archivedAt: null },
  });
}

export function remove(id: string, userId: string) {
  return prisma.wallet.deleteMany({ where: { id, userId } });
}
