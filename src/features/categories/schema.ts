import { z } from "zod";
import { TransactionType } from "@/generated/prisma/enums";

export const categoryTypeSchema = z.enum([
  TransactionType.INCOME,
  TransactionType.EXPENSE,
]);

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi")
    .max(40, "Maksimal 40 karakter"),
  type: categoryTypeSchema,
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Warna tidak valid")
    .optional(),
  icon: z.string().trim().max(8).optional(),
});

export const updateCategorySchema = createCategorySchema;

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
