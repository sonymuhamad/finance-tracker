"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/service";
import { type ActionResult, runAction } from "@/lib/action";
import { DomainError } from "@/lib/errors";
import {
  adjustBalanceSchema,
  createWalletSchema,
  updateWalletSchema,
} from "./schema";
import * as service from "./service";

/** Wallet mutations affect both the wallets page and the home X. */
function revalidateWallets() {
  revalidatePath("/wallets");
  revalidatePath("/");
}

function readInput(formData: FormData) {
  const isPrimary = formData.get("isPrimary");
  return {
    name: formData.get("name"),
    type: formData.get("type"),
    startingBalance: formData.get("startingBalance") ?? undefined,
    emoji: formData.get("emoji") || undefined,
    color: formData.get("color") || undefined,
    isPrimary: isPrimary === "true" || isPrimary === "on" ? true : undefined,
  };
}

export async function createWalletAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = createWalletSchema.safeParse(readInput(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Input tidak valid",
    };
  }
  return runAction(async () => {
    await service.createWallet(user.id, parsed.data);
    revalidateWallets();
  });
}

export async function updateWalletAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { ok: false, error: "Dompet tidak valid" };
  }
  const parsed = updateWalletSchema.safeParse(readInput(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Input tidak valid",
    };
  }
  return runAction(async () => {
    await service.updateWallet(user.id, id, parsed.data);
    revalidateWallets();
  });
}

export async function setPrimaryWalletAction(
  id: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!id) throw new DomainError("Dompet tidak valid");
  return runAction(async () => {
    await service.setPrimaryWallet(user.id, id);
    revalidateWallets();
  });
}

export async function adjustWalletBalanceAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { ok: false, error: "Dompet tidak valid" };
  }
  const parsed = adjustBalanceSchema.safeParse({
    // `|| undefined` so a cleared field (empty string) becomes a validation
    // error, not a silent `Number("") === 0` that zeroes the wallet.
    targetBalance: formData.get("targetBalance") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Input tidak valid",
    };
  }
  return runAction(async () => {
    await service.adjustBalance(user.id, id, parsed.data);
    revalidateWallets();
  });
}

export async function restoreWalletAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!id) throw new DomainError("Dompet tidak valid");
  return runAction(async () => {
    await service.restoreWallet(user.id, id);
    revalidateWallets();
  });
}

/** Deleting reports whether the wallet was archived (had history) vs removed. */
export type DeleteWalletResult =
  | { ok: true; archived: boolean }
  | { ok: false; error: string };

export async function deleteWalletAction(
  id: string,
): Promise<DeleteWalletResult> {
  const user = await requireUser();
  if (!id) return { ok: false, error: "Dompet tidak valid" };
  try {
    const { archived } = await service.removeWallet(user.id, id);
    revalidateWallets();
    return { ok: true, archived };
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
