import { z } from "zod";
import { PaymentMethod } from "@/generated/prisma/enums";

const amountField = z.coerce
  .number({ message: "Jumlah tidak valid" })
  .finite("Jumlah tidak valid")
  .positive("Jumlah harus lebih dari 0")
  // Cap well under Decimal(18,2) and Number.MAX_SAFE_INTEGER so a huge value
  // can't overflow the DB column (an unhandled 500) or lose integer precision.
  .max(1_000_000_000_000, "Jumlah terlalu besar");

const noteField = z.string().trim().max(50, "Maksimal 50 karakter").optional();

export const paymentMethodSchema = z.enum([
  PaymentMethod.CASH,
  PaymentMethod.CREDIT_CARD,
  PaymentMethod.PAYLATER,
]);
export type PaymentMethodValue = z.infer<typeof paymentMethodSchema>;

export const expenseSchema = z
  .object({
    amount: amountField,
    date: z.coerce.date({ message: "Tanggal tidak valid" }),
    method: paymentMethodSchema,
    walletId: z.string().optional(), // required for CASH
    cardId: z.string().optional(), // required for CC / paylater
    dueDate: z.coerce.date().optional(), // CC / paylater; defaults from the card
    categoryId: z.string().optional(),
    note: noteField,
    // Cash only: when false, record a PLANNED future cash expense (sits in the
    // cycle's "bakal keluar" until confirmed) instead of deducting now. Absent /
    // true → paid now (ACTUAL). Ignored for CC/paylater (always due-date PLANNED).
    paid: z.boolean().optional(),
  })
  .refine((v) => v.method !== PaymentMethod.CASH || !!v.walletId, {
    message: "Pilih dompet",
    path: ["walletId"],
  })
  .refine((v) => v.method === PaymentMethod.CASH || !!v.cardId, {
    message: "Pilih kartu",
    path: ["cardId"],
  });

export const recurringObligationSchema = z.object({
  amount: amountField,
  dayOfMonth: z.coerce
    .number({ message: "Tanggal tidak valid" })
    .int("Tanggal tidak valid")
    .min(1, "Tanggal 1–31")
    .max(31, "Tanggal 1–31"),
  walletId: z.string().min(1, "Pilih dompet pembayar"),
  cardId: z.string().optional(),
  categoryId: z.string().optional(),
  note: noteField,
});

// Edit a one-off expense movement (cash or a card obligation). The date doubles
// as the due date for a card obligation.
export const updateExpenseSchema = z.object({
  movementId: z.string().min(1),
  amount: amountField,
  date: z.coerce.date({ message: "Tanggal tidak valid" }),
  categoryId: z.string().optional(),
  note: noteField,
});

// Per-occurrence overrides on a recurring obligation (this cycle only; the rule
// keeps running). Keyed by rule + the occurrence's date.
export const adjustOccurrenceSchema = z.object({
  ruleId: z.string().min(1),
  occurrenceDate: z.coerce.date(),
  amount: amountField,
});

export const occurrenceSchema = z.object({
  ruleId: z.string().min(1),
  occurrenceDate: z.coerce.date(),
});

export const confirmObligationSchema = z.object({
  movementId: z.string().min(1),
  amount: amountField.optional(),
  walletId: z.string().optional(),
  date: z.coerce.date().optional(),
});

export const confirmRecurringObligationSchema = z.object({
  ruleId: z.string().min(1),
  occurrenceDate: z.coerce.date(),
  amount: amountField.optional(),
  walletId: z.string().optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type AdjustOccurrenceInput = z.infer<typeof adjustOccurrenceSchema>;
export type OccurrenceInput = z.infer<typeof occurrenceSchema>;
export type RecurringObligationInput = z.infer<
  typeof recurringObligationSchema
>;
export type ConfirmObligationInput = z.infer<typeof confirmObligationSchema>;
export type ConfirmRecurringObligationInput = z.infer<
  typeof confirmRecurringObligationSchema
>;
