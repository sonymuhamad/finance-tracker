/**
 * Expense timing (RFC 0008). Pure — no I/O.
 *
 * A CC / paylater purchase becomes an obligation due on the card's due day. The
 * default due date is the next occurrence of that day-of-month on or after the
 * purchase date (clamped to month length), computed on the Jakarta calendar via
 * the cycle date convention.
 */

import { toCycleDate } from "@/lib/cycle";

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** The next date with day-of-month `dueDay` on or after `from`. */
export function nextDueDate(dueDay: number, from: Date): Date {
  const base = toCycleDate(from); // UTC-midnight of the Jakarta calendar date
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const day = base.getUTCDate();

  const thisMonth = Math.min(dueDay, daysInMonth(year, month));
  if (thisMonth >= day) {
    return new Date(Date.UTC(year, month, thisMonth));
  }

  const nextYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  return new Date(
    Date.UTC(
      nextYear,
      nextMonth,
      Math.min(dueDay, daysInMonth(nextYear, nextMonth)),
    ),
  );
}
