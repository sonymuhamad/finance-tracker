import { requireUser } from "@/features/auth/service";
import { toCardDTO } from "@/features/cards/mapper";
import { listCategories } from "@/features/categories/service";
import { ExpenseManager } from "@/features/expenses/components/expense-manager";
import { toExpenseViewDTO } from "@/features/expenses/mapper";
import { listExpenses } from "@/features/expenses/service";
import { getCycleForecast } from "@/features/home/service";
import { MovementType } from "@/generated/prisma/enums";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const user = await requireUser();
  const { offset: offsetRaw } = await searchParams;
  const parsed = Number(offsetRaw);
  const offset = Number.isFinite(parsed)
    ? Math.max(0, Math.min(12, Math.trunc(parsed)))
    : 0;

  const [view, categories, { forecast, wallets: walletList }] =
    await Promise.all([
      listExpenses(user.id, offset),
      listCategories(user.id),
      // Reuse the home forecast so "aman dipakai" (Z) is identical to Beranda —
      // single source of truth, no drift — and you don't bounce to see it. It
      // also returns the wallets (with balances) it was built from, so we render
      // names without a second listWallets pass.
      getCycleForecast(user.id, offset),
    ]);

  const tags = categories
    .filter((c) => c.type === MovementType.EXPENSE)
    .map((c) => ({ id: c.id, name: c.name, icon: c.icon }));
  const wallets = walletList.map(({ wallet }) => ({
    id: wallet.id,
    name: wallet.name,
    emoji: wallet.emoji,
  }));
  const cards = view.cards.map(toCardDTO);

  const recap = {
    z: forecast.z,
    perDay: forecast.perDayAllowance,
    isProjected: forecast.isProjected,
  };

  return (
    <div className="py-6">
      <ExpenseManager
        view={toExpenseViewDTO(view)}
        recap={recap}
        cards={cards}
        wallets={wallets}
        tags={tags}
      />
    </div>
  );
}
