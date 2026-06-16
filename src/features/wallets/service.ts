import { adjustmentDelta, deriveBalance } from "@/features/movements/balance";
import * as movementsRepo from "@/features/movements/repository";
import { createMovement } from "@/features/movements/service";
import { MovementStatus, MovementType } from "@/generated/prisma/enums";
import { toCycleDate } from "@/lib/cycle";
import { DomainError, prismaErrorCode } from "@/lib/errors";
import { poolBalances } from "./balance";
import { DEFAULT_WALLET } from "./defaults";
import * as repo from "./repository";
import type {
  AdjustBalanceInput,
  CreateWalletInput,
  UpdateWalletInput,
} from "./schema";

/**
 * Wallets (RFC 0006). Balances are derived from the movement spine (RFC 0005):
 * a wallet's balance = its starting balance + the net of its ACTUAL movements.
 * The pooled total of the active wallets is the home's "X / Punya sekarang".
 */

/** A wallet's actual movements, shaped for the pure balance helpers. */
async function actualMovements(userId: string, walletId: string) {
  const rows = await movementsRepo.listActualByWallet(userId, walletId);
  return rows.map((m) => ({ ...m, amount: Number(m.amount) }));
}

/**
 * Lists a user's wallets, seeding a default Cash wallet on first use, with each
 * active wallet's derived balance and the pooled total.
 */
export async function listWallets(userId: string) {
  if ((await repo.countByUser(userId)) === 0) {
    await repo.createPrimary(userId, DEFAULT_WALLET);
  }

  const [active, archived, actualRows] = await Promise.all([
    repo.listActive(userId),
    repo.listArchived(userId),
    // One query for all ACTUAL movements (tagged with walletId) instead of one
    // per wallet — poolBalances groups them and ignores any non-active wallet.
    movementsRepo.listActualByUser(userId),
  ]);

  const movements = actualRows.map((m) => ({
    walletId: m.walletId,
    type: m.type,
    status: m.status,
    amount: Number(m.amount),
  }));

  const { perWallet, pooled } = poolBalances(
    active.map((w) => ({
      id: w.id,
      startingBalance: Number(w.startingBalance),
    })),
    movements,
  );
  const balanceById = new Map(perWallet.map((p) => [p.walletId, p.balance]));

  return {
    wallets: active.map((wallet) => ({
      wallet,
      balance: balanceById.get(wallet.id) ?? Number(wallet.startingBalance),
    })),
    pooled,
    archived,
  };
}

export async function createWallet(userId: string, input: CreateWalletInput) {
  const { isPrimary, ...data } = input;
  // The first wallet (or one explicitly chosen) becomes the primary hub.
  const makePrimary = isPrimary === true || !(await repo.findPrimary(userId));
  return makePrimary
    ? repo.createPrimary(userId, data)
    : repo.create(userId, data);
}

export async function updateWallet(
  userId: string,
  id: string,
  input: UpdateWalletInput,
) {
  const res = await repo.update(id, userId, input);
  if (res.count === 0) throw new DomainError("Dompet tidak ditemukan.");
}

/**
 * Make a wallet the primary hub. Picking a new primary demotes the current one
 * in a single transaction; the target must be an existing, active wallet (we
 * check before the swap so we never end up with no primary).
 */
export async function setPrimaryWallet(userId: string, id: string) {
  const wallet = await repo.findById(id, userId);
  if (!wallet || wallet.archivedAt) {
    throw new DomainError("Dompet tidak ditemukan.");
  }
  await repo.setPrimary(userId, id);
}

/**
 * Correct a wallet's balance to what it actually holds, recorded as a signed
 * ADJUSTMENT movement so history stays reconcilable. A no-op when already there.
 */
export async function adjustBalance(
  userId: string,
  id: string,
  input: AdjustBalanceInput,
  now: Date = new Date(),
) {
  const wallet = await repo.findById(id, userId);
  if (!wallet || wallet.archivedAt) {
    throw new DomainError("Dompet tidak ditemukan.");
  }

  const current = deriveBalance(
    Number(wallet.startingBalance),
    await actualMovements(userId, id),
  );
  const delta = adjustmentDelta(current, input.targetBalance);
  if (delta === 0) return;

  await createMovement({
    userId,
    type: MovementType.ADJUSTMENT,
    status: MovementStatus.ACTUAL,
    amount: delta,
    walletId: id,
    categoryId: null,
    paymentMethod: null,
    occurredAt: now,
    effectiveDate: toCycleDate(now),
    note: input.note ?? null,
  });
}

export async function restoreWallet(userId: string, id: string) {
  const res = await repo.restore(id, userId);
  if (res.count === 0) throw new DomainError("Dompet tidak ditemukan.");
}

/**
 * Delete a wallet. A fresh wallet is hard-deleted; one that still has history
 * (movements / cards / recurring rules → `onDelete: Restrict`, surfaced as P2003)
 * is archived instead, so the history stays intact. The primary can't be removed
 * — set another wallet primary first.
 */
export async function removeWallet(
  userId: string,
  id: string,
): Promise<{ archived: boolean }> {
  const wallet = await repo.findById(id, userId);
  if (!wallet) throw new DomainError("Dompet tidak ditemukan.");
  if (wallet.isPrimary) {
    throw new DomainError(
      "Jadikan dompet lain sebagai utama dulu sebelum menghapus dompet ini.",
    );
  }

  try {
    await repo.remove(id, userId);
    return { archived: false };
  } catch (error) {
    if (prismaErrorCode(error) === "P2003") {
      await repo.archive(id, userId, new Date());
      return { archived: true };
    }
    throw error;
  }
}
