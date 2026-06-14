import { requireUser } from "@/features/auth/service";
import { listCategories } from "@/features/categories/service";
import { IncomeManager } from "@/features/income/components/income-manager";
import { toIncomeViewDTO } from "@/features/income/mapper";
import { listIncome } from "@/features/income/service";
import { listWallets } from "@/features/wallets/service";
import { MovementType } from "@/generated/prisma/enums";

export default async function IncomePage() {
  const user = await requireUser();
  const [view, categories, walletData] = await Promise.all([
    listIncome(user.id),
    listCategories(user.id),
    listWallets(user.id),
  ]);

  const tags = categories
    .filter((c) => c.type === MovementType.INCOME)
    .map((c) => ({ id: c.id, name: c.name, icon: c.icon }));
  const wallets = walletData.wallets.map(({ wallet }) => ({
    id: wallet.id,
    name: wallet.name,
    emoji: wallet.emoji,
  }));

  return (
    <div className="py-6">
      <IncomeManager
        view={toIncomeViewDTO(view)}
        wallets={wallets}
        tags={tags}
      />
    </div>
  );
}
