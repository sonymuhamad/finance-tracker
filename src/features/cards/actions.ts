"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/service";
import { type ActionResult, runAction } from "@/lib/action";
import { DomainError } from "@/lib/errors";
import { createCardSchema, updateCardSchema } from "./schema";
import * as service from "./service";

function revalidateCards() {
  revalidatePath("/expenses");
  revalidatePath("/");
}

function readInput(formData: FormData) {
  return {
    name: formData.get("name"),
    kind: formData.get("kind"),
    defaultDueDay: formData.get("defaultDueDay") || undefined,
    payingWalletId: formData.get("payingWalletId") || undefined,
  };
}

export async function createCardAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = createCardSchema.safeParse(readInput(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Input tidak valid",
    };
  }
  return runAction(async () => {
    await service.createCard(user.id, parsed.data);
    revalidateCards();
  });
}

export async function updateCardAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { ok: false, error: "Kartu tidak valid" };
  }
  const parsed = updateCardSchema.safeParse(readInput(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Input tidak valid",
    };
  }
  return runAction(async () => {
    await service.updateCard(user.id, id, parsed.data);
    revalidateCards();
  });
}

export type DeleteCardResult =
  | { ok: true; archived: boolean }
  | { ok: false; error: string };

export async function deleteCardAction(id: string): Promise<DeleteCardResult> {
  const user = await requireUser();
  if (!id) return { ok: false, error: "Kartu tidak valid" };
  try {
    const { archived } = await service.removeCard(user.id, id);
    revalidateCards();
    return { ok: true, archived };
  } catch (error) {
    if (error instanceof DomainError)
      return { ok: false, error: error.message };
    throw error;
  }
}
