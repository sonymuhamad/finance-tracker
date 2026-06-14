/**
 * Pure wallet-balance composition (RFC 0006). No I/O — the service feeds these.
 *
 * A wallet's balance is derived from the movement spine (RFC 0005): its starting
 * balance plus the net of its ACTUAL movements. The pooled total — the home's
 * "X / Punya sekarang" — sums the balances of the wallets passed in (active
 * wallets only; movements for any other wallet are ignored).
 */

import { deriveBalance } from "@/features/movements/balance";
import type { MovementStatus, MovementType } from "@/generated/prisma/enums";
import { roundMoney } from "@/lib/money";

export type WalletForPool = { id: string; startingBalance: number };

export type PoolMovement = {
  walletId: string;
  type: MovementType;
  status: MovementStatus;
  amount: number;
};

export type WalletBalance = { walletId: string; balance: number };

export function poolBalances(
  wallets: WalletForPool[],
  movements: PoolMovement[],
): { perWallet: WalletBalance[]; pooled: number } {
  const byWallet = new Map<string, PoolMovement[]>();
  for (const m of movements) {
    const list = byWallet.get(m.walletId);
    if (list) list.push(m);
    else byWallet.set(m.walletId, [m]);
  }

  const perWallet = wallets.map((w) => ({
    walletId: w.id,
    balance: deriveBalance(w.startingBalance, byWallet.get(w.id) ?? []),
  }));

  const pooled = roundMoney(perWallet.reduce((sum, w) => sum + w.balance, 0));

  return { perWallet, pooled };
}
