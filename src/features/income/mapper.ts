import type { RecurringRule } from "@/generated/prisma/client";
import type {
  IncomeItem,
  IncomeItemDTO,
  IncomeView,
  IncomeViewDTO,
  RecurringIncomeDTO,
} from "./types";

function toRecurringDTO(rule: RecurringRule): RecurringIncomeDTO {
  return {
    id: rule.id,
    amount: Number(rule.amount),
    dayOfMonth: rule.dayOfMonth,
    walletId: rule.walletId,
    categoryId: rule.categoryId,
    note: rule.note,
  };
}

function toItemDTO(item: IncomeItem): IncomeItemDTO {
  return { ...item, effectiveDate: item.effectiveDate.toISOString() };
}

export function toIncomeViewDTO(view: IncomeView): IncomeViewDTO {
  return {
    cycle: {
      offset: view.cycle.offset,
      label: view.cycle.label,
      start: view.cycle.start.toISOString(),
      end: view.cycle.end.toISOString(),
      isCurrent: view.cycle.isCurrent,
    },
    hasPrimaryIncome: view.hasPrimaryIncome,
    primary: view.primary ? toRecurringDTO(view.primary) : null,
    recurringSources: view.recurringSources.map(toRecurringDTO),
    items: view.items.map(toItemDTO),
  };
}
