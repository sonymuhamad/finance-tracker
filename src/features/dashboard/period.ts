export type Period = { year: number; month: number }; // month is 1-12

/** UTC [start, end) range for a given month. Matches how occurredAt is stored. */
export function monthRange(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

/** Shift a month by delta, wrapping years correctly (handles negatives). */
export function shiftMonth(year: number, month: number, delta: number): Period {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function formatMonthParam(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Parse "YYYY-MM"; fall back to the given `now` month when missing/invalid. */
export function parseMonthParam(param: string | undefined, now: Date): Period {
  if (param) {
    const match = /^(\d{4})-(\d{2})$/.exec(param);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      if (month >= 1 && month <= 12) return { year, month };
    }
  }
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}
