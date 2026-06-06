import type { MovementType } from "@/generated/prisma/enums";

/** Input to create a monthly recurring rule (income or expense). */
export type RecurringRuleInput = {
  userId: string;
  type: MovementType; // INCOME | EXPENSE (never ADJUSTMENT)
  amount: number;
  dayOfMonth: number; // 1..31, clamps for short months
  walletId: string;
  cardId?: string | null;
  categoryId?: string | null;
  isPrimaryIncome?: boolean;
  note?: string | null;
  startsOn: Date;
};
