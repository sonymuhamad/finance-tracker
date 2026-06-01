"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/service";
import { type ActionResult, runAction } from "@/lib/action";
import { DomainError } from "@/lib/errors";
import { createCategorySchema, updateCategorySchema } from "./schema";
import * as service from "./service";

function readInput(formData: FormData) {
  return {
    name: formData.get("name"),
    type: formData.get("type"),
    color: formData.get("color") || undefined,
    icon: formData.get("icon") || undefined,
  };
}

export async function createCategoryAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = createCategorySchema.safeParse(readInput(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Input tidak valid",
    };
  }
  return runAction(async () => {
    await service.createCategory(user.id, parsed.data);
    revalidatePath("/categories");
  });
}

export async function updateCategoryAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { ok: false, error: "Kategori tidak valid" };
  }
  const parsed = updateCategorySchema.safeParse(readInput(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Input tidak valid",
    };
  }
  return runAction(async () => {
    await service.updateCategory(user.id, id, parsed.data);
    revalidatePath("/categories");
  });
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!id) throw new DomainError("Kategori tidak valid");
  return runAction(async () => {
    await service.deleteCategory(user.id, id);
    revalidatePath("/categories");
  });
}
