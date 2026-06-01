import { DomainError } from "@/lib/errors";
import * as repo from "./repository";
import type { CreateTransactionInput, UpdateTransactionInput } from "./schema";
import type { TransactionDTO } from "./types";

const DEFAULT_LIMIT = 50;

type RowWithCategory = Awaited<ReturnType<typeof repo.listByUser>>[number];

function toDTO(row: RowWithCategory): TransactionDTO {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    occurredAt: row.occurredAt.toISOString(),
    note: row.note,
    category: {
      id: row.category.id,
      name: row.category.name,
      color: row.category.color,
      icon: row.category.icon,
    },
  };
}

export async function listRecent(
  userId: string,
  limit = DEFAULT_LIMIT,
): Promise<TransactionDTO[]> {
  const rows = await repo.listByUser(userId, limit);
  return rows.map(toDTO);
}

/** Ensures the category is owned by the user and matches the transaction type. */
async function assertValidCategory(
  userId: string,
  categoryId: string,
  type: CreateTransactionInput["type"],
) {
  const category = await repo.findOwnedCategory(userId, categoryId);
  if (!category) throw new DomainError("Kategori tidak ditemukan.");
  if (category.type !== type) {
    throw new DomainError("Tipe transaksi tidak cocok dengan kategorinya.");
  }
}

export async function createTransaction(
  userId: string,
  input: CreateTransactionInput,
) {
  await assertValidCategory(userId, input.categoryId, input.type);
  await repo.create(userId, {
    type: input.type,
    amount: input.amount,
    categoryId: input.categoryId,
    occurredAt: input.occurredAt,
    note: input.note,
  });
}

export async function updateTransaction(
  userId: string,
  input: UpdateTransactionInput,
) {
  await assertValidCategory(userId, input.categoryId, input.type);
  const res = await repo.update(input.id, userId, {
    type: input.type,
    amount: input.amount,
    categoryId: input.categoryId,
    occurredAt: input.occurredAt,
    note: input.note,
  });
  if (res.count === 0) throw new DomainError("Transaksi tidak ditemukan.");
}

export async function deleteTransaction(userId: string, id: string) {
  const res = await repo.remove(id, userId);
  if (res.count === 0) throw new DomainError("Transaksi tidak ditemukan.");
}
