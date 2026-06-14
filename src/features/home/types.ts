export type ForecastItemDTO = {
  kind: "income" | "expense";
  amount: number;
  effectiveDate: string;
  movementId: string | null;
  ruleId: string | null;
  cardId: string | null;
  categoryId: string | null;
  walletId: string;
  note: string | null;
};

export type CycleChipDTO = {
  offset: number;
  label: string;
  isCurrent: boolean;
};

export type ForecastDTO = {
  cycle: { offset: number; label: string; isCurrent: boolean };
  isProjected: boolean;
  x: number;
  y: number;
  cycleIncome: number;
  z: number;
  perDayAllowance: number;
  daysLeft: number;
  perWallet: { walletId: string; balance: number }[];
  obligations: ForecastItemDTO[];
  toConfirm: ForecastItemDTO[];
};

export type HomeDTO = {
  forecast: ForecastDTO;
  strip: CycleChipDTO[];
  hasPrimaryIncome: boolean;
};
