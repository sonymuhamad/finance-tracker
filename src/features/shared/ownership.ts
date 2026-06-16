import * as cardsRepo from "@/features/cards/repository";
import * as categoriesRepo from "@/features/categories/repository";
import * as walletsRepo from "@/features/wallets/repository";
import { DomainError } from "@/lib/errors";

/**
 * Cross-entity ownership guard.
 *
 * Every domain row is stamped with the caller's `userId`, but when an action
 * accepts a *foreign-key id* from the client (walletId / cardId / categoryId)
 * the DB FK only proves the referenced entity *exists* — not that the caller
 * owns it. Without this check an authenticated user could reference another
 * user's wallet/card/category (cross-tenant IDOR + a data-integrity break that
 * can even lock the victim out of deleting their own row via the Restrict FK).
 *
 * Call this in every service that writes a client-supplied reference, before
 * the write. Only the ids that are present (truthy) are checked; pass whichever
 * subset the input carries. Reuses the already-userId-scoped repo finders.
 */
export async function assertOwned(
  userId: string,
  refs: {
    walletId?: string | null;
    cardId?: string | null;
    categoryId?: string | null;
  },
): Promise<void> {
  if (refs.walletId) {
    const wallet = await walletsRepo.findById(refs.walletId, userId);
    if (!wallet) throw new DomainError("Dompet tidak ditemukan.");
  }
  if (refs.cardId) {
    const card = await cardsRepo.findById(refs.cardId, userId);
    if (!card) throw new DomainError("Kartu tidak ditemukan.");
  }
  if (refs.categoryId) {
    const category = await categoriesRepo.findById(refs.categoryId, userId);
    if (!category) throw new DomainError("Kategori tidak ditemukan.");
  }
}
