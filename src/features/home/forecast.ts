/**
 * The forecast core (RFC 0009). Pure — no I/O.
 *
 * Z = "aman dipakai sampai gajian". For the current cycle Z = X − Y (what you
 * hold minus what's still due). For a future cycle Z = projected opening +
 * that cycle's income − its obligations.
 *
 * `pooledNow` already includes every ACTUAL movement, so this only ever consumes
 * **pending** events (PLANNED movements + projected recurring occurrences) — never
 * ACTUAL — to avoid double-counting.
 */

import { type Cycle, toCycleDate } from "@/lib/cycle";
import { roundMoney } from "@/lib/money";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ForecastEvent = {
  kind: "income" | "expense";
  amount: number;
  effectiveDate: Date;
  movementId: string | null; // a PLANNED movement (confirmable)
  ruleId: string | null; // a projected occurrence (materialize on confirm)
  cardId: string | null;
  categoryId: string | null;
  walletId: string;
  note: string | null; // shown to tell same-tag items apart (projections carry the rule's note)
};

export type WalletSlice = { walletId: string; balance: number };

export type Forecast = {
  cycle: Cycle;
  isProjected: boolean;
  x: number; // current: pooled now; future: projected opening
  y: number; // obligations landing in the cycle
  cycleIncome: number; // income landing in the cycle
  z: number; // safe to spend
  perDayAllowance: number;
  daysLeft: number;
  perWallet: WalletSlice[];
  obligations: ForecastEvent[]; // the Y breakdown (expenses in the cycle)
  toConfirm: ForecastEvent[]; // pending items due (current cycle only)
};

export type ForecastInput = {
  pooledNow: number;
  perWallet: WalletSlice[];
  cycle: Cycle;
  isProjected: boolean;
  today: Date;
  events: ForecastEvent[];
};

const byDate = (a: ForecastEvent, b: ForecastEvent) =>
  a.effectiveDate.getTime() - b.effectiveDate.getTime();

export function computeForecast(input: ForecastInput): Forecast {
  const { pooledNow, perWallet, cycle, isProjected, events } = input;
  const today = toCycleDate(input.today);

  const inCycle = (e: ForecastEvent) =>
    e.effectiveDate >= cycle.start && e.effectiveDate <= cycle.end;

  const obligations = events
    .filter((e) => e.kind === "expense" && inCycle(e))
    .sort(byDate);
  const cycleIncomeEvents = events.filter(
    (e) => e.kind === "income" && inCycle(e),
  );

  const y = roundMoney(obligations.reduce((s, e) => s + e.amount, 0));
  const cycleIncome = roundMoney(
    cycleIncomeEvents.reduce((s, e) => s + e.amount, 0),
  );

  let x: number;
  let z: number;
  if (!isProjected) {
    x = roundMoney(pooledNow);
    z = roundMoney(x - y);
  } else {
    const interveningNet = events
      .filter((e) => e.effectiveDate >= today && e.effectiveDate < cycle.start)
      .reduce((s, e) => s + (e.kind === "income" ? e.amount : -e.amount), 0);
    x = roundMoney(pooledNow + interveningNet);
    z = roundMoney(x + cycleIncome - y);
  }

  const daysLeft = isProjected
    ? Math.round((cycle.end.getTime() - cycle.start.getTime()) / DAY_MS) + 1
    : Math.max(
        1,
        Math.round((cycle.end.getTime() - today.getTime()) / DAY_MS) + 1,
      );
  const perDayAllowance = roundMoney(Math.max(0, z) / daysLeft);

  // Items in this cycle already due (income to receive / obligations to pay).
  const toConfirm = isProjected
    ? []
    : events.filter((e) => inCycle(e) && e.effectiveDate <= today).sort(byDate);

  return {
    cycle,
    isProjected,
    x,
    y,
    cycleIncome,
    z,
    perDayAllowance,
    daysLeft,
    perWallet,
    obligations,
    toConfirm,
  };
}
