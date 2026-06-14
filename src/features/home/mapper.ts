import type { Cycle } from "@/lib/cycle";
import type { Forecast, ForecastEvent } from "./forecast";
import type { ForecastItemDTO, HomeDTO } from "./types";

function toItemDTO(e: ForecastEvent): ForecastItemDTO {
  return {
    kind: e.kind,
    amount: e.amount,
    effectiveDate: e.effectiveDate.toISOString(),
    movementId: e.movementId,
    ruleId: e.ruleId,
    cardId: e.cardId,
    categoryId: e.categoryId,
    walletId: e.walletId,
    note: e.note,
  };
}

export function toHomeDTO(input: {
  forecast: Forecast;
  strip: Cycle[];
  hasPrimaryIncome: boolean;
}): HomeDTO {
  const { forecast: f } = input;
  return {
    forecast: {
      cycle: {
        offset: f.cycle.offset,
        label: f.cycle.label,
        isCurrent: f.cycle.isCurrent,
      },
      isProjected: f.isProjected,
      x: f.x,
      y: f.y,
      cycleIncome: f.cycleIncome,
      z: f.z,
      perDayAllowance: f.perDayAllowance,
      daysLeft: f.daysLeft,
      perWallet: f.perWallet,
      obligations: f.obligations.map(toItemDTO),
      toConfirm: f.toConfirm.map(toItemDTO),
    },
    strip: input.strip.map((c) => ({
      offset: c.offset,
      label: c.label,
      isCurrent: c.isCurrent,
    })),
    hasPrimaryIncome: input.hasPrimaryIncome,
  };
}
