import type {
  MovementStatus,
  MovementType,
  PaymentMethod,
} from "@/generated/prisma/enums";

/**
 * Everything needed to persist a movement. Feature services (income, expenses,
 * wallets) build this — resolving timing, due dates and the paying wallet — then
 * hand it to the movements module.
 */
export type MovementInput = {
  userId: string;
  type: MovementType;
  status: MovementStatus;
  amount: number; // major unit; ADJUSTMENT may be negative (signed delta)
  walletId: string;
  cardId?: string | null;
  categoryId?: string | null;
  paymentMethod?: PaymentMethod | null;
  occurredAt: Date;
  effectiveDate: Date;
  note?: string | null;
  recurringRuleId?: string | null;
  confirmedAt?: Date | null;
};
