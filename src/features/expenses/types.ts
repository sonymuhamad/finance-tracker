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

/** At-a-glance spending totals for the selected cycle, derived from `items` so
 * the headline always equals the sum of what's listed. `skipped` is excluded. */
export type ExpenseSummary = {
  spent: number; // already-out this cycle (ACTUAL / paid)
  upcoming: number; // still due (PLANNED + projected) — equals the home's Y
  total: number; // spent + upcoming
  count: number; // contributing (non-skipped) items
};

/** Domain shape returned by `expenses.service.listExpenses` (dates as `Date`). */
export type ExpenseView = {
  cycle: Cycle;
  anchorDay: number; // for the client-side impact preview
  strip: Cycle[]; // current + forward cycles for the switcher
  recurringObligations: RecurringRule[];
  cards: Card[];
  items: ExpenseItem[];
  summary: ExpenseSummary;
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
  summary: ExpenseSummary;
};
