import type { RecurringRule } from "@/generated/prisma/client";
import type {
  ExpenseItem,
  ExpenseItemDTO,
  ExpenseView,
  ExpenseViewDTO,
  RecurringObligationDTO,
} from "./types";

function toObligationDTO(rule: RecurringRule): RecurringObligationDTO {
  return {
    id: rule.id,
    amount: Number(rule.amount),
    dayOfMonth: rule.dayOfMonth,
    walletId: rule.walletId,
    cardId: rule.cardId,
    categoryId: rule.categoryId,
    note: rule.note,
  };
}

function toItemDTO(item: ExpenseItem): ExpenseItemDTO {
  return { ...item, effectiveDate: item.effectiveDate.toISOString() };
}

export function toExpenseViewDTO(view: ExpenseView): ExpenseViewDTO {
  return {
    cycle: {
      offset: view.cycle.offset,
      label: view.cycle.label,
      start: view.cycle.start.toISOString(),
      end: view.cycle.end.toISOString(),
      isCurrent: view.cycle.isCurrent,
    },
    anchorDay: view.anchorDay,
    strip: view.strip.map((c) => ({ offset: c.offset, label: c.label })),
    recurringObligations: view.recurringObligations.map(toObligationDTO),
    items: view.items.map(toItemDTO),
    summary: view.summary,
  };
}
