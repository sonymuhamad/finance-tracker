import type { Card, RecurringRule } from "@/generated/prisma/client";
import type { PaymentMethod } from "@/generated/prisma/enums";
import type { Cycle } from "@/lib/cycle";

/** Expense occurrences in a cycle: already-paid (cash/confirmed), due (planned
 * obligation), projected (recurring obligation not yet materialized), or skipped
 * (a recurring occurrence skipped for this cycle — shown muted, restorable). */
export type ExpenseItemKind = "paid" | "due" | "projected" | "skipped";

export type ExpenseItem = {
  kind: ExpenseItemKind;
  movementId: string | null;
  ruleId: string | null;
  amount: number;
  walletId: string;
  cardId: string | null;
  categoryId: string | null;
  paymentMethod: PaymentMethod | null;
  effectiveDate: Date;
  note: string | null;
};

export type ExpenseItemDTO = Omit<ExpenseItem, "effectiveDate"> & {
  effectiveDate: string;
};

export type RecurringObligationDTO = {
  id: string;
  amount: number;
  dayOfMonth: number;
  walletId: string;
  cardId: string | null;
  categoryId: string | null;
  note: string | null;
};

/** Domain shape returned by `expenses.service.listExpenses` (dates as `Date`). */
export type ExpenseView = {
  cycle: Cycle;
  anchorDay: number; // for the client-side impact preview
  strip: Cycle[]; // current + forward cycles for the switcher
  recurringObligations: RecurringRule[];
  cards: Card[];
  items: ExpenseItem[];
};

export type ExpenseViewDTO = {
  cycle: {
    offset: number;
    label: string;
    start: string;
    end: string;
    isCurrent: boolean;
  };
  anchorDay: number;
  strip: { offset: number; label: string }[];
  recurringObligations: RecurringObligationDTO[];
  items: ExpenseItemDTO[];
};
