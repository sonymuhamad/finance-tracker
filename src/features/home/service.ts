import * as movementsRepo from "@/features/movements/repository";
import {
  type ProjectedOccurrence,
  projectOccurrences,
  toProjectionRule,
} from "@/features/recurring/projection";
import * as recurringRepo from "@/features/recurring/repository";
import { listActiveRules } from "@/features/recurring/service";
import { listWallets } from "@/features/wallets/service";
import type { Movement } from "@/generated/prisma/client";
import { MovementStatus, MovementType } from "@/generated/prisma/enums";
import {
  type Cycle,
  getCurrentCycle,
  getCycleByOffset,
  getCycleRange,
} from "@/lib/cycle";
import { computeForecast, type Forecast, type ForecastEvent } from "./forecast";

/**
 * The home forecast (RFC 0009). Pure orchestration: reads wallets + the movement
 * spine + recurring rules and feeds the pure `computeForecast`. Owns no table.
 */

const FORWARD = 12; // cap the switcher at 12 cycles forward (PRD 008)
// Current + forward only. Past cycles are omitted: a correct past "X" needs the
// cycle's opening balance reconstructed, which is out of MVP scope — showing
// today's pooled balance for a past cycle would be misleading.
const BACK = 0;

function inCycle(date: Date, cycle: Cycle) {
  return date >= cycle.start && date <= cycle.end;
}

export async function getCycleForecast(
  userId: string,
  offset = 0,
  now: Date = new Date(),
): Promise<{
  forecast: Forecast;
  strip: Cycle[];
  hasPrimaryIncome: boolean;
  // The wallets (with derived balances) the forecast was built from — returned so
  // the page can render names without a second listWallets (balance) computation.
  wallets: Awaited<ReturnType<typeof listWallets>>["wallets"];
}> {
  const walletData = await listWallets(userId);
  const pooledNow = walletData.pooled;
  const perWallet = walletData.wallets.map((w) => ({
    walletId: w.wallet.id,
    balance: w.balance,
  }));

  const primary = await recurringRepo.findPrimaryIncome(userId);
  const anchorDay = primary?.dayOfMonth ?? 1;
  const current = getCurrentCycle(anchorDay, now);
  const target = getCycleByOffset(anchorDay, now, offset);

  // Window from whichever of current/target starts first, through the target end.
  const windowStart = offset >= 0 ? current.start : target.start;
  const [movements, rules] = await Promise.all([
    movementsRepo.listByUserInWindow(userId, windowStart, target.end),
    listActiveRules(userId),
  ]);
  const projectionRules = rules.map(toProjectionRule);

  // Project recurring occurrences across every cycle between current and target,
  // excluding any rule already materialized in that cycle (no double-count).
  const projected: ProjectedOccurrence[] = [];
  const lo = Math.min(0, offset);
  const hi = Math.max(0, offset);
  for (let o = lo; o <= hi; o++) {
    const cyc = getCycleByOffset(anchorDay, now, o);
    const materialized = new Set(
      movements
        .filter((m) => inCycle(m.effectiveDate, cyc))
        .map((m) => m.recurringRuleId)
        .filter((id): id is string => id !== null),
    );
    projected.push(...projectOccurrences(projectionRules, cyc, materialized));
  }

  // Only PENDING events feed the forecast — ACTUAL is already baked into pooledNow.
  const planned = movements.filter((m) => m.status === MovementStatus.PLANNED);
  const events: ForecastEvent[] = [
    ...planned.map((m: Movement) => ({
      kind:
        m.type === MovementType.INCOME
          ? ("income" as const)
          : ("expense" as const),
      amount: Number(m.amount),
      effectiveDate: m.effectiveDate,
      movementId: m.id,
      ruleId: m.recurringRuleId,
      cardId: m.cardId,
      categoryId: m.categoryId,
      walletId: m.walletId,
      note: m.note,
    })),
    ...projected.map((p) => ({
      kind:
        p.type === MovementType.INCOME
          ? ("income" as const)
          : ("expense" as const),
      amount: p.amount,
      effectiveDate: p.effectiveDate,
      movementId: null,
      ruleId: p.ruleId,
      cardId: p.cardId,
      categoryId: p.categoryId,
      walletId: p.walletId,
      note: p.note, // the rule's note — distinguishes same-tag recurring items
    })),
  ];

  const forecast = computeForecast({
    pooledNow,
    perWallet,
    cycle: target,
    isProjected: offset > 0,
    today: now,
    events,
  });

  const strip = getCycleRange(anchorDay, now, { back: BACK, forward: FORWARD });

  return {
    forecast,
    strip,
    hasPrimaryIncome: primary !== null,
    wallets: walletData.wallets,
  };
}
