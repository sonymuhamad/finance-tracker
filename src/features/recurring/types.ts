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

/** Editable fields of a recurring rule (RFC 0007); edits apply going forward. */
export type RecurringRuleUpdate = {
  amount?: number;
  dayOfMonth?: number;
  walletId?: string;
  cardId?: string | null;
  categoryId?: string | null;
  note?: string | null;
};
