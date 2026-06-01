import { DomainError, prismaErrorCode } from "@/lib/errors";
import { DEFAULT_CATEGORIES } from "./defaults";
import * as repo from "./repository";
import type { CreateCategoryInput, UpdateCategoryInput } from "./schema";

/** Lists a user's categories, seeding defaults on first use. */
export async function listCategories(userId: string) {
  const count = await repo.countByUser(userId);
  if (count === 0) {
    await repo.createManyDefaults(userId, DEFAULT_CATEGORIES);
  }
  return repo.listByUser(userId);
}

export async function createCategory(
  userId: string,
  input: CreateCategoryInput,
) {
  try {
    return await repo.create(userId, input);
  } catch (error) {
    if (prismaErrorCode(error) === "P2002") {
      throw new DomainError("Kategori dengan nama & tipe itu sudah ada.");
    }
    throw error;
  }
}

export async function updateCategory(
  userId: string,
  id: string,
  input: UpdateCategoryInput,
) {
  try {
    const res = await repo.update(id, userId, input);
    if (res.count === 0) throw new DomainError("Kategori tidak ditemukan.");
  } catch (error) {
    if (prismaErrorCode(error) === "P2002") {
      throw new DomainError("Kategori dengan nama & tipe itu sudah ada.");
    }
    throw error;
  }
}

export async function deleteCategory(userId: string, id: string) {
  try {
    const res = await repo.remove(id, userId);
    if (res.count === 0) throw new DomainError("Kategori tidak ditemukan.");
  } catch (error) {
    // onDelete: Restrict — the category is still referenced by a transaction.
    if (prismaErrorCode(error) === "P2003") {
      throw new DomainError(
        "Kategori masih dipakai transaksi, jadi tidak bisa dihapus.",
      );
    }
    throw error;
  }
}
