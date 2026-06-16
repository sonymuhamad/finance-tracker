import { assertOwned } from "@/features/shared/ownership";
import { DomainError, prismaErrorCode } from "@/lib/errors";
import * as repo from "./repository";
import type { CreateCardInput, UpdateCardInput } from "./schema";

/**
 * Cards (RFC 0008): the CC / paylater paying instruments. A card carries a
 * default due day + paying wallet; CC/paylater expenses become obligations paid
 * from that wallet on the due date.
 */

export function listCards(userId: string) {
  return repo.listActive(userId);
}

export async function createCard(userId: string, input: CreateCardInput) {
  await assertOwned(userId, { walletId: input.payingWalletId });
  return repo.create(userId, input);
}

export async function updateCard(
  userId: string,
  id: string,
  input: UpdateCardInput,
) {
  await assertOwned(userId, { walletId: input.payingWalletId });
  const res = await repo.update(id, userId, input);
  if (res.count === 0) throw new DomainError("Kartu tidak ditemukan.");
}

/**
 * Delete a card. A fresh card is hard-deleted; one referenced elsewhere is
 * archived (kept out of pickers, history intact). Movement/RecurringRule links
 * are `SetNull`, so deletion rarely trips P2003 — the fallback is defensive.
 */
export async function removeCard(
  userId: string,
  id: string,
): Promise<{ archived: boolean }> {
  const found = await repo.findById(id, userId);
  if (!found) throw new DomainError("Kartu tidak ditemukan.");
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
