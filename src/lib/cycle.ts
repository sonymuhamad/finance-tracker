/**
 * Payday-cycle math (RFC 0005). Pure functions, no I/O.
 *
 * A cycle is anchored to the primary income's day-of-month (`anchorDay`): it
 * runs from `anchorDay` of one month (inclusive) to the day before `anchorDay`
 * of the next month (inclusive). The anchor clamps to the month length (e.g. 31
 * → 28/30). When there is no primary income, callers pass `anchorDay = 1`, which
 * yields calendar months.
 *
 * Dates are interpreted on the Asia/Jakarta calendar; boundaries are returned as
 * UTC-midnight `Date`s of that calendar date, so day math stays timezone-stable.
 */

export type Cycle = {
  /** 0 = current, +N forward, -N past. */
  offset: number;
  /** Inclusive first day (UTC midnight of the calendar date). */
  start: Date;
  /** Inclusive last day (UTC midnight of the calendar date). */
  end: Date;
  /** e.g. "25 Mei – 24 Jun". */
  label: string;
  isCurrent: boolean;
};

// Matches date-fns `id` locale short month names.
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of `month`.
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

/** The Asia/Jakarta calendar date of an instant. */
function jakartaParts(d: Date): { year: number; month: number; day: number } {
  const j = new Date(d.getTime() + JAKARTA_OFFSET_MS);
  return {
    year: j.getUTCFullYear(),
    month: j.getUTCMonth(),
    day: j.getUTCDate(),
  };
}

/** The {year, month} of the cycle that contains `date` (its start's month). */
function cycleStartMonth(
  anchorDay: number,
  date: Date,
): { year: number; month: number } {
  const { year, month, day } = jakartaParts(date);
  const anchor = clampDay(year, month, anchorDay);
  if (day >= anchor) return { year, month };
  return month === 0
    ? { year: year - 1, month: 11 }
    : { year, month: month - 1 };
}

function formatLabel(start: Date, end: Date): string {
  const s = `${start.getUTCDate()} ${MONTHS_SHORT[start.getUTCMonth()]}`;
  const e = `${end.getUTCDate()} ${MONTHS_SHORT[end.getUTCMonth()]}`;
  return `${s} – ${e}`;
}

function buildCycle(
  anchorDay: number,
  year: number,
  month: number,
  offset: number,
): Cycle {
  const start = new Date(
    Date.UTC(year, month, clampDay(year, month, anchorDay)),
  );
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const nextStart = new Date(
    Date.UTC(nextYear, nextMonth, clampDay(nextYear, nextMonth, anchorDay)),
  );
  const end = new Date(nextStart.getTime() - DAY_MS);
  return {
    offset,
    start,
    end,
    label: formatLabel(start, end),
    isCurrent: offset === 0,
  };
}

/** The cycle `offset` steps from the one containing `today`. */
export function getCycleByOffset(
  anchorDay: number,
  today: Date,
  offset: number,
): Cycle {
  const cur = cycleStartMonth(anchorDay, today);
  const total = cur.year * 12 + cur.month + offset;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  return buildCycle(anchorDay, year, month, offset);
}

/** The cycle containing `today`. */
export function getCurrentCycle(anchorDay: number, today: Date): Cycle {
  return getCycleByOffset(anchorDay, today, 0);
}

/**
 * Normalize an instant to the UTC midnight of its Asia/Jakarta calendar date —
 * the canonical representation for every cycle-aligned date (cycle boundaries,
 * `effectiveDate`, `startsOn`, `endedAt`). Dates must be normalized before being
 * compared or stored, so a time-of-day never shifts a date across a boundary.
 */
export function toCycleDate(date: Date): Date {
  const { year, month, day } = jakartaParts(date);
  return new Date(Date.UTC(year, month, day));
}

/** Which offset (relative to `today`'s cycle) the given `date` falls in. */
export function cycleOf(anchorDay: number, today: Date, date: Date): number {
  const cur = cycleStartMonth(anchorDay, today);
  const tgt = cycleStartMonth(anchorDay, date);
  return tgt.year * 12 + tgt.month - (cur.year * 12 + cur.month);
}

/**
 * The date a monthly `dayOfMonth` rule fires within a cycle (or null if it
 * somehow doesn't). A cycle spans one calendar month's worth of days across two
 * months, so a monthly rule fires exactly once inside it; the day clamps to the
 * relevant month's length.
 */
export function occurrenceDateInCycle(
  dayOfMonth: number,
  cycle: Cycle,
): Date | null {
  const startY = cycle.start.getUTCFullYear();
  const startM = cycle.start.getUTCMonth();
  const inStartMonth = new Date(
    Date.UTC(startY, startM, clampDay(startY, startM, dayOfMonth)),
  );
  if (inStartMonth >= cycle.start && inStartMonth <= cycle.end) {
    return inStartMonth;
  }

  const endY = cycle.end.getUTCFullYear();
  const endM = cycle.end.getUTCMonth();
  const inEndMonth = new Date(
    Date.UTC(endY, endM, clampDay(endY, endM, dayOfMonth)),
  );
  if (inEndMonth >= cycle.start && inEndMonth <= cycle.end) {
    return inEndMonth;
  }

  return null;
}

/** Cycles from `-back` to `+forward` (inclusive), ordered past → future. */
export function getCycleRange(
  anchorDay: number,
  today: Date,
  { back, forward }: { back: number; forward: number },
): Cycle[] {
  const cycles: Cycle[] = [];
  for (let offset = -back; offset <= forward; offset++) {
    cycles.push(getCycleByOffset(anchorDay, today, offset));
  }
  return cycles;
}
