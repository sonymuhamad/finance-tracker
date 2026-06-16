import { z } from "zod";

const amountField = z.coerce
  .number({ message: "Jumlah tidak valid" })
  .finite("Jumlah tidak valid")
  .positive("Jumlah harus lebih dari 0")
  // Cap well under Decimal(18,2) and Number.MAX_SAFE_INTEGER so a huge value
  // can't overflow the DB column (an unhandled 500) or lose integer precision.
  .max(1_000_000_000_000, "Jumlah terlalu besar");

const dayField = z.coerce
  .number({ message: "Tanggal tidak valid" })
  .int("Tanggal tidak valid");

const walletField = z.string().min(1, "Pilih dompet");
const noteField = z.string().trim().max(50, "Maksimal 50 karakter").optional();

const recurringBase = z.object({
  amount: amountField,
  walletId: walletField,
  categoryId: z.string().optional(),
  note: noteField,
});

// The PRIMARY income's day-of-month is the cycle anchor; constrained to 1–28 so
// every cycle stays clean in short months (RFC 0005 risk mitigation).
export const primaryIncomeSchema = recurringBase.extend({
  dayOfMonth: dayField
    .min(1, "Tanggal 1–28")
    .max(28, "Gaji utama: tanggal 1–28"),
});

// Secondary recurring income doesn't anchor the cycle, so 1–31 is fine.
export const recurringIncomeSchema = recurringBase.extend({
  dayOfMonth: dayField.min(1, "Tanggal 1–31").max(31, "Tanggal 1–31"),
});

export const oneOffIncomeSchema = z.object({
  amount: amountField,
  date: z.coerce.date({ message: "Tanggal tidak valid" }),
  walletId: walletField,
  categoryId: z.string().optional(),
  note: noteField,
  received: z.boolean().default(false),
});

// Edit a one-off income movement (received or expected).
export const updateIncomeSchema = z.object({
  movementId: z.string().min(1),
  amount: amountField,
  date: z.coerce.date({ message: "Tanggal tidak valid" }),
  categoryId: z.string().optional(),
  note: noteField,
});

export const confirmIncomeSchema = z.object({
  movementId: z.string().min(1),
  amount: amountField.optional(),
  walletId: z.string().optional(),
  date: z.coerce.date().optional(),
});

export const confirmRecurringIncomeSchema = z.object({
  ruleId: z.string().min(1),
  occurrenceDate: z.coerce.date(),
  amount: amountField.optional(),
  walletId: z.string().optional(),
});

export type PrimaryIncomeInput = z.infer<typeof primaryIncomeSchema>;
export type RecurringIncomeInput = z.infer<typeof recurringIncomeSchema>;
export type OneOffIncomeInput = z.infer<typeof oneOffIncomeSchema>;
export type UpdateIncomeInput = z.infer<typeof updateIncomeSchema>;
export type ConfirmIncomeInput = z.infer<typeof confirmIncomeSchema>;
export type ConfirmRecurringIncomeInput = z.infer<
  typeof confirmRecurringIncomeSchema
>;
