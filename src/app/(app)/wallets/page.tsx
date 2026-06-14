import { requireUser } from "@/features/auth/service";
import { WalletManager } from "@/features/wallets/components/wallet-manager";
import { toArchivedWalletDTO, toWalletDTO } from "@/features/wallets/mapper";
import { listWallets } from "@/features/wallets/service";

export default async function WalletsPage() {
  const user = await requireUser();
  const { wallets, pooled, archived } = await listWallets(user.id);

  return (
    <div className="py-6">
      <WalletManager
        initial={wallets.map(({ wallet, balance }) =>
          toWalletDTO(wallet, balance),
        )}
        pooled={pooled}
        archived={archived.map(toArchivedWalletDTO)}
      />
    </div>
  );
}
