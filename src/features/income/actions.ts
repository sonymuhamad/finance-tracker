"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/service";
import { type ActionResult, runAction } from "@/lib/action";
import { DomainError } from "@/lib/errors";
import {
  oneOffIncomeSchema,
  primaryIncomeSchema,
  recurringIncomeSchema,
  updateIncomeSchema,
} from "./schema";
import * as service from "./service";

/** Income changes affect the income page and the home forecast. */
function revalidateIncome() {
  revalidatePath("/income");
  revalidatePath("/");
}

function readRecurring(formData: FormData) {
  return {
    amount: formData.get("amount") || undefined,
    dayOfMonth: formData.get("dayOfMonth") || undefined,
    walletId: formData.get("walletId") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    note: formData.get("note") || undefined,
  };
}

function fail(message: string | undefined): ActionResult {
  return { ok: false, error: message ?? "Input tidak valid" };
}

export async function setPrimaryIncomeAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = primaryIncomeSchema.safeParse(readRecurring(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message);
  return runAction(async () => {
    await service.setPrimaryIncome(user.id, parsed.data);
    revalidateIncome();
  });
}

export async function addRecurringIncomeAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = recurringIncomeSchema.safeParse(readRecurring(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message);
  return runAction(async () => {
    await service.addRecurringIncome(user.id, parsed.data);
    revalidateIncome();
  });
}

export async function updateRecurringIncomeAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return fail("Pemasukan tidak valid");
  const parsed = recurringIncomeSchema.safeParse(readRecurring(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message);
  return runAction(async () => {
    await service.updateRecurringIncome(user.id, id, parsed.data);
    revalidateIncome();
  });
}

export async function endRecurringIncomeAction(
  id: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!id) throw new DomainError("Pemasukan tidak valid");
  return runAction(async () => {
    await service.endRecurringIncome(user.id, id);
    revalidateIncome();
  });
}

export async function addOneOffIncomeAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const received = formData.get("received");
  const parsed = oneOffIncomeSchema.safeParse({
    amount: formData.get("amount") || undefined,
    date: formData.get("date") || undefined,
    walletId: formData.get("walletId") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    note: formData.get("note") || undefined,
    received: received === "true" || received === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message);
  return runAction(async () => {
    await service.addOneOffIncome(user.id, parsed.data);
    revalidateIncome();
  });
}

export async function updateIncomeAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = updateIncomeSchema.safeParse({
    movementId: formData.get("movementId") || undefined,
    amount: formData.get("amount") || undefined,
    date: formData.get("date") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message);
  return runAction(async () => {
    await service.updateIncome(user.id, parsed.data);
    revalidateIncome();
  });
}

export async function deleteIncomeAction(
  movementId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!movementId) throw new DomainError("Pemasukan tidak valid");
  return runAction(async () => {
    await service.deleteIncome(user.id, movementId);
    revalidateIncome();
  });
}

/** One-tap confirm of an expected one-off income (amount defaults to planned). */
export async function confirmIncomeAction(
  movementId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!movementId) throw new DomainError("Pemasukan tidak valid");
  return runAction(async () => {
    await service.confirmIncome(user.id, { movementId });
    revalidateIncome();
  });
}

/** One-tap confirm of a projected recurring income occurrence (materializes it). */
export async function confirmRecurringIncomeAction(
  ruleId: string,
  occurrenceDateISO: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!ruleId || !occurrenceDateISO) {
    throw new DomainError("Pemasukan tidak valid");
  }
  return runAction(async () => {
    await service.confirmRecurringIncome(user.id, {
      ruleId,
      occurrenceDate: new Date(occurrenceDateISO),
    });
    revalidateIncome();
  });
}
