import { TransactionType } from "@/generated/prisma/enums";
import { monthRange } from "./period";
import * as repo from "./repository";
import type { MonthlySummary } from "./types";

export async function getMonthlySummary(
  userId: string,
  year: number,
  month: number,
): Promise<MonthlySummary> {
  const { start, end } = monthRange(year, month);

  const [byType, byCategory] = await Promise.all([
    repo.sumByType(userId, start, end),
    repo.sumExpenseByCategory(userId, start, end),
  ]);

  const income = Number(
    byType.find((t) => t.type === TransactionType.INCOME)?._sum.amount ?? 0,
  );
  const expense = Number(
    byType.find((t) => t.type === TransactionType.EXPENSE)?._sum.amount ?? 0,
  );

  const ids = byCategory.map((row) => row.categoryId);
  const categories = ids.length ? await repo.categoriesByIds(userId, ids) : [];
  const meta = new Map(categories.map((c) => [c.id, c]));

  const breakdown = byCategory
    .map((row) => {
      const total = Number(row._sum.amount ?? 0);
      const category = meta.get(row.categoryId);
      return {
        id: row.categoryId,
        name: category?.name ?? "—",
        color: category?.color ?? null,
        icon: category?.icon ?? null,
        total,
        percentage: expense > 0 ? Math.round((total / expense) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    year,
    month,
    income,
    expense,
    net: income - expense,
    byCategory: breakdown,
  };
}
