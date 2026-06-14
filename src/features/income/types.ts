import type { RecurringRule } from "@/generated/prisma/client";
import type { Cycle } from "@/lib/cycle";

/** Income occurrences in a cycle: already-received, expected (planned one-off),
 * or projected (from a recurring rule, not yet materialized). */
export type IncomeItemKind = "received" | "expected" | "projected";

/** Domain item returned by the service (dates as `Date`). */
export type IncomeItem = {
  kind: IncomeItemKind;
  movementId: string | null; // set for received / expected (a real Movement)
  ruleId: string | null; // set for projected / rule-linked items
  amount: number;
  walletId: string;
  categoryId: string | null;
  effectiveDate: Date;
  note: string | null;
};

/** Serializable item for client components (dates as ISO strings). */
export type IncomeItemDTO = Omit<IncomeItem, "effectiveDate"> & {
  effectiveDate: string;
};

export type RecurringIncomeDTO = {
  id: string;
  amount: number;
  dayOfMonth: number;
  walletId: string;
  categoryId: string | null;
  note: string | null;
};

export type IncomeViewDTO = {
  cycle: {
    offset: number;
    label: string;
    start: string;
    end: string;
    isCurrent: boolean;
  };
  hasPrimaryIncome: boolean;
  primary: RecurringIncomeDTO | null;
  recurringSources: RecurringIncomeDTO[];
  items: IncomeItemDTO[];
};

/** Domain shape returned by `income.service.listIncome` (dates as `Date`). */
export type IncomeView = {
  cycle: Cycle;
  hasPrimaryIncome: boolean;
  primary: RecurringRule | null;
  recurringSources: RecurringRule[];
  items: IncomeItem[];
};
