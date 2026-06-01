import { z } from "zod";
import { TransactionType } from "@/generated/prisma/enums";

export const createTransactionSchema = z.object({
  type: z.enum([TransactionType.INCOME, TransactionType.EXPENSE]),
  amount: z.coerce
    .number({ message: "Jumlah tidak valid" })
    .positive("Jumlah harus lebih dari 0"),
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  occurredAt: z.coerce.date({ message: "Tanggal tidak valid" }),
  note: z.string().trim().max(140, "Maksimal 140 karakter").optional(),
});

export const updateTransactionSchema = createTransactionSchema.extend({
  id: z.string().min(1),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
