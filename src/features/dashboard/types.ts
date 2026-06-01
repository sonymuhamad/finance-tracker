export type CategoryBreakdown = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  total: number;
  percentage: number; // 0-100, share of total expense
};

export type MonthlySummary = {
  year: number;
  month: number;
  income: number;
  expense: number;
  net: number;
  byCategory: CategoryBreakdown[]; // expenses, sorted desc
};
