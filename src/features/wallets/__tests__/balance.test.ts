import { describe, expect, it } from "vitest";
import { MovementStatus, MovementType } from "@/generated/prisma/enums";
import { type PoolMovement, poolBalances } from "../balance";

const actual = (
  walletId: string,
  type: MovementType,
  amount: number,
): PoolMovement => ({
  walletId,
  type,
  status: MovementStatus.ACTUAL,
  amount,
});

describe("poolBalances", () => {
  it("derives each wallet's balance and pools the active total", () => {
    const wallets = [
      { id: "bca", startingBalance: 6_000_000 },
      { id: "gopay", startingBalance: 1_000_000 },
    ];
    const movements = [
      actual("bca", MovementType.INCOME, 500_000),
      actual("bca", MovementType.EXPENSE, 300_000),
      actual("gopay", MovementType.EXPENSE, 100_000),
    ];

    const { perWallet, pooled } = poolBalances(wallets, movements);

    expect(perWallet).toEqual([
      { walletId: "bca", balance: 6_200_000 },
      { walletId: "gopay", balance: 900_000 },
    ]);
    expect(pooled).toBe(7_100_000);
  });

  it("ignores planned movements (not moved yet)", () => {
    const wallets = [{ id: "bca", startingBalance: 1_000_000 }];
    const movements: PoolMovement[] = [
      {
        walletId: "bca",
        type: MovementType.EXPENSE,
        status: MovementStatus.PLANNED,
        amount: 800_000,
      },
      actual("bca", MovementType.INCOME, 50_000),
    ];

    const { perWallet, pooled } = poolBalances(wallets, movements);

    expect(perWallet[0]?.balance).toBe(1_050_000);
    expect(pooled).toBe(1_050_000);
  });

  it("treats an adjustment as a signed delta", () => {
    const wallets = [{ id: "cash", startingBalance: 500_000 }];
    const movements = [actual("cash", MovementType.ADJUSTMENT, -200_000)];

    expect(poolBalances(wallets, movements).pooled).toBe(300_000);
  });

  it("a wallet with no movements keeps its starting balance", () => {
    const wallets = [{ id: "cash", startingBalance: 250_000 }];

    const { perWallet, pooled } = poolBalances(wallets, []);

    expect(perWallet).toEqual([{ walletId: "cash", balance: 250_000 }]);
    expect(pooled).toBe(250_000);
  });

  it("excludes movements whose wallet is not in the pool (e.g. archived)", () => {
    const wallets = [{ id: "bca", startingBalance: 1_000_000 }];
    const movements = [
      actual("bca", MovementType.INCOME, 100_000),
      actual("archived", MovementType.INCOME, 9_000_000),
    ];

    const { pooled } = poolBalances(wallets, movements);

    expect(pooled).toBe(1_100_000);
  });

  it("pools nothing when there are no wallets", () => {
    expect(poolBalances([], [])).toEqual({ perWallet: [], pooled: 0 });
  });
});
