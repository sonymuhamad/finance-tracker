"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/service";
import { type ActionResult, runAction } from "@/lib/action";
import { DomainError } from "@/lib/errors";
import {
  adjustOccurrenceSchema,
  expenseSchema,
  occurrenceSchema,
  recurringObligationSchema,
  updateExpenseSchema,
} from "./schema";
import * as service from "./service";

function revalidateExpenses() {
  revalidatePath("/expenses");
  revalidatePath("/");
}

function fail(message: string | undefined): ActionResult {
  return { ok: false, error: message ?? "Input tidak valid" };
}

function readObligation(formData: FormData) {
  return {
    amount: formData.get("amount") || undefined,
    dayOfMonth: formData.get("dayOfMonth") || undefined,
    walletId: formData.get("walletId") || undefined,
    cardId: formData.get("cardId") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    note: formData.get("note") || undefined,
  };
}

export async function recordExpenseAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const paidRaw = formData.get("paid");
  const parsed = expenseSchema.safeParse({
    amount: formData.get("amount") || undefined,
    date: formData.get("date") || undefined,
    method: formData.get("method") || undefined,
    walletId: formData.get("walletId") || undefined,
    cardId: formData.get("cardId") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    note: formData.get("note") || undefined,
    // Absent → paid now (the common case); only an explicit "false" plans it.
    paid: paidRaw === null ? undefined : paidRaw !== "false",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message);
  return runAction(async () => {
    await service.recordExpense(user.id, parsed.data);
    revalidateExpenses();
  });
}

export async function updateExpenseAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = updateExpenseSchema.safeParse({
    movementId: formData.get("movementId") || undefined,
    amount: formData.get("amount") || undefined,
    date: formData.get("date") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message);
  return runAction(async () => {
    await service.updateExpense(user.id, parsed.data);
    revalidateExpenses();
  });
}

export async function deleteExpenseAction(
  movementId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!movementId) throw new DomainError("Pengeluaran tidak valid");
  return runAction(async () => {
    await service.deleteExpense(user.id, movementId);
    revalidateExpenses();
  });
}

export async function addRecurringObligationAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = recurringObligationSchema.safeParse(readObligation(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message);
  return runAction(async () => {
    await service.addRecurringObligation(user.id, parsed.data);
    revalidateExpenses();
  });
}

export async function updateRecurringObligationAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return fail("Tagihan tidak valid");
  const parsed = recurringObligationSchema.safeParse(readObligation(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message);
  return runAction(async () => {
    await service.updateRecurringObligation(user.id, id, parsed.data);
    revalidateExpenses();
  });
}

export async function endRecurringObligationAction(
  id: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!id) throw new DomainError("Tagihan tidak valid");
  return runAction(async () => {
    await service.endRecurringObligation(user.id, id);
    revalidateExpenses();
  });
}

export async function adjustObligationOccurrenceAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = adjustOccurrenceSchema.safeParse({
    ruleId: formData.get("ruleId") || undefined,
    occurrenceDate: formData.get("occurrenceDate") || undefined,
    amount: formData.get("amount") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message);
  return runAction(async () => {
    await service.adjustObligationOccurrence(user.id, parsed.data);
    revalidateExpenses();
  });
}

export async function skipObligationOccurrenceAction(
  ruleId: string,
  occurrenceDateISO: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = occurrenceSchema.safeParse({
    ruleId: ruleId || undefined,
    occurrenceDate: occurrenceDateISO || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message);
  return runAction(async () => {
    await service.skipObligationOccurrence(user.id, parsed.data);
    revalidateExpenses();
  });
}

export async function restoreObligationOccurrenceAction(
  ruleId: string,
  occurrenceDateISO: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = occurrenceSchema.safeParse({
    ruleId: ruleId || undefined,
    occurrenceDate: occurrenceDateISO || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message);
  return runAction(async () => {
    await service.restoreObligationOccurrence(user.id, parsed.data);
    revalidateExpenses();
  });
}

export async function confirmObligationAction(
  movementId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!movementId) throw new DomainError("Tagihan tidak valid");
  return runAction(async () => {
    await service.confirmObligation(user.id, { movementId });
    revalidateExpenses();
  });
}

export async function confirmRecurringObligationAction(
  ruleId: string,
  occurrenceDateISO: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!ruleId || !occurrenceDateISO) {
    throw new DomainError("Tagihan tidak valid");
  }
  return runAction(async () => {
    await service.confirmRecurringObligation(user.id, {
      ruleId,
      occurrenceDate: new Date(occurrenceDateISO),
    });
    revalidateExpenses();
  });
}
