"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/service";
import { type ActionResult, runAction } from "@/lib/action";
import { createTransactionSchema, updateTransactionSchema } from "./schema";
import * as service from "./service";

function readInput(formData: FormData) {
  return {
    type: formData.get("type"),
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId"),
    occurredAt: formData.get("occurredAt"),
    note: formData.get("note") || undefined,
  };
}

function revalidate() {
  revalidatePath("/");
  revalidatePath("/transactions");
}

export async function createTransactionAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = createTransactionSchema.safeParse(readInput(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Input tidak valid",
    };
  }
  return runAction(async () => {
    await service.createTransaction(user.id, parsed.data);
    revalidate();
  });
}

export async function updateTransactionAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = updateTransactionSchema.safeParse({
    ...readInput(formData),
    id: formData.get("id"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Input tidak valid",
    };
  }
  return runAction(async () => {
    await service.updateTransaction(user.id, parsed.data);
    revalidate();
  });
}

export async function deleteTransactionAction(
  id: string,
): Promise<ActionResult> {
  const user = await requireUser();
  return runAction(async () => {
    await service.deleteTransaction(user.id, id);
    revalidate();
  });
}
