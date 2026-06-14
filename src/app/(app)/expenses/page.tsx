import { requireUser } from "@/features/auth/service";
import { toCardDTO } from "@/features/cards/mapper";
import { listCategories } from "@/features/categories/service";
import { ExpenseManager } from "@/features/expenses/components/expense-manager";
import { toExpenseViewDTO } from "@/features/expenses/mapper";
import { listExpenses } from "@/features/expenses/service";
import { listWallets } from "@/features/wallets/service";
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

  const [view, categories, walletData] = await Promise.all([
    listExpenses(user.id, offset),
    listCategories(user.id),
    listWallets(user.id),
  ]);

  const tags = categories
    .filter((c) => c.type === MovementType.EXPENSE)
    .map((c) => ({ id: c.id, name: c.name, icon: c.icon }));
  const wallets = walletData.wallets.map(({ wallet }) => ({
    id: wallet.id,
    name: wallet.name,
    emoji: wallet.emoji,
  }));
  const cards = view.cards.map(toCardDTO);

  return (
    <div className="py-6">
      <ExpenseManager
        view={toExpenseViewDTO(view)}
        cards={cards}
        wallets={wallets}
        tags={tags}
      />
    </div>
  );
}
