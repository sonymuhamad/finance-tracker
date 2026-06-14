import { z } from "zod";
import { CardKind } from "@/generated/prisma/enums";

export const cardKindSchema = z.enum([CardKind.CREDIT_CARD, CardKind.PAYLATER]);
export type CardKindValue = z.infer<typeof cardKindSchema>;

export const createCardSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi")
    .max(40, "Maksimal 40 karakter"),
  kind: cardKindSchema,
  // The card's default due day-of-month; an obligation inherits it (editable per
  // purchase). 1–31, clamps for short months.
  defaultDueDay: z.coerce
    .number({ message: "Tanggal tidak valid" })
    .int("Tanggal tidak valid")
    .min(1, "Tanggal 1–31")
    .max(31, "Tanggal 1–31"),
  payingWalletId: z.string().min(1, "Pilih dompet pembayar"),
});

export const updateCardSchema = createCardSchema;

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
