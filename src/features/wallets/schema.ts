import { z } from "zod";
import { WalletType } from "@/generated/prisma/enums";

export const walletTypeSchema = z.enum([
  WalletType.CASH,
  WalletType.BANK,
  WalletType.EWALLET,
]);

export type WalletTypeValue = z.infer<typeof walletTypeSchema>;

const balanceField = z.coerce
  .number({ message: "Saldo tidak valid" })
  .finite("Saldo tidak valid")
  .min(0, "Saldo tidak boleh negatif");

export const createWalletSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi")
    .max(40, "Maksimal 40 karakter"),
  type: walletTypeSchema,
  // Set once at creation; later corrections go through an adjustment, never by
  // editing this (keeps history reconcilable — RFC 0006).
  startingBalance: balanceField.default(0),
  emoji: z.string().trim().max(8).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Warna tidak valid")
    .optional(),
  isPrimary: z.boolean().optional(),
});

export const updateWalletSchema = createWalletSchema.omit({
  startingBalance: true,
  isPrimary: true,
});

export const adjustBalanceSchema = z.object({
  // The balance the user says the wallet actually holds now; the service records
  // the signed difference as an ADJUSTMENT movement.
  targetBalance: balanceField,
  note: z.string().trim().max(50, "Maksimal 50 karakter").optional(),
});

export type CreateWalletInput = z.infer<typeof createWalletSchema>;
export type UpdateWalletInput = z.infer<typeof updateWalletSchema>;
export type AdjustBalanceInput = z.infer<typeof adjustBalanceSchema>;
