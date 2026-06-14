import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Wallet } from "@/generated/prisma/client";
import {
  MovementStatus,
  MovementType,
  WalletType,
} from "@/generated/prisma/enums";
import { toCycleDate } from "@/lib/cycle";
import { DomainError } from "@/lib/errors";

// Mock only the I/O layers; the pure helpers (deriveBalance, adjustmentDelta,
// poolBalances, cycle) and movements.service run for real.
vi.mock("../repository");
vi.mock("@/features/movements/repository");

import * as movementsRepo from "@/features/movements/repository";
import { DEFAULT_WALLET } from "../defaults";
import * as repo from "../repository";
import * as service from "../service";

const walletRow = (over: Record<string, unknown>): Wallet =>
  ({
    id: "w",
    userId: "u1",
    name: "Wallet",
    type: WalletType.CASH,
    startingBalance: 0,
    isPrimary: false,
    emoji: null,
    color: null,
    archivedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...over,
  }) as unknown as Wallet;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listWallets", () => {
  it("seeds a default Cash wallet on first use", async () => {
    vi.mocked(repo.countByUser).mockResolvedValue(0);
    vi.mocked(repo.createPrimary).mockResolvedValue(walletRow({}));
    vi.mocked(repo.listActive).mockResolvedValue([]);
    vi.mocked(repo.listArchived).mockResolvedValue([]);

    await service.listWallets("u1");

    expect(repo.createPrimary).toHaveBeenCalledWith("u1", DEFAULT_WALLET);
  });

  it("does not seed when the user already has wallets", async () => {
    vi.mocked(repo.countByUser).mockResolvedValue(2);
    vi.mocked(repo.listActive).mockResolvedValue([]);
    vi.mocked(repo.listArchived).mockResolvedValue([]);

    await service.listWallets("u1");

    expect(repo.createPrimary).not.toHaveBeenCalled();
  });

  it("returns each wallet's derived balance and the pooled total", async () => {
    vi.mocked(repo.countByUser).mockResolvedValue(2);
    vi.mocked(repo.listActive).mockResolvedValue([
      walletRow({ id: "bca", startingBalance: 1_000_000, isPrimary: true }),
      walletRow({ id: "cash", startingBalance: 200_000 }),
    ]);
    vi.mocked(repo.listArchived).mockResolvedValue([]);
    vi.mocked(movementsRepo.listActualByWallet).mockImplementation(
      (_userId: string, walletId: string) =>
        Promise.resolve(
          walletId === "bca"
            ? [
                {
                  type: MovementType.EXPENSE,
                  status: MovementStatus.ACTUAL,
                  amount: 300_000,
                },
              ]
            : [],
        ) as unknown as ReturnType<typeof movementsRepo.listActualByWallet>,
    );

    const result = await service.listWallets("u1");

    expect(result.pooled).toBe(900_000);
    expect(result.wallets.find((w) => w.wallet.id === "bca")?.balance).toBe(
      700_000,
    );
    expect(result.wallets.find((w) => w.wallet.id === "cash")?.balance).toBe(
      200_000,
    );
  });
});

describe("createWallet", () => {
  it("creates the first wallet as primary", async () => {
    vi.mocked(repo.findPrimary).mockResolvedValue(null);
    vi.mocked(repo.createPrimary).mockResolvedValue(walletRow({}));

    await service.createWallet("u1", {
      name: "BCA",
      type: WalletType.BANK,
      startingBalance: 0,
    });

    expect(repo.createPrimary).toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("creates a later wallet as non-primary", async () => {
    vi.mocked(repo.findPrimary).mockResolvedValue(
      walletRow({ id: "cash", isPrimary: true }),
    );
    vi.mocked(repo.create).mockResolvedValue(walletRow({}));

    await service.createWallet("u1", {
      name: "GoPay",
      type: WalletType.EWALLET,
      startingBalance: 50_000,
    });

    expect(repo.create).toHaveBeenCalled();
    expect(repo.createPrimary).not.toHaveBeenCalled();
  });

  it("creates as primary when explicitly requested", async () => {
    vi.mocked(repo.findPrimary).mockResolvedValue(
      walletRow({ id: "cash", isPrimary: true }),
    );
    vi.mocked(repo.createPrimary).mockResolvedValue(walletRow({}));

    await service.createWallet("u1", {
      name: "BCA",
      type: WalletType.BANK,
      startingBalance: 0,
      isPrimary: true,
    });

    expect(repo.createPrimary).toHaveBeenCalled();
  });
});

describe("updateWallet", () => {
  it("rejects updating a missing wallet", async () => {
    vi.mocked(repo.update).mockResolvedValue({ count: 0 });

    await expect(
      service.updateWallet("u1", "x", { name: "X", type: WalletType.CASH }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("setPrimaryWallet", () => {
  it("sets an active wallet as primary", async () => {
    vi.mocked(repo.findById).mockResolvedValue(
      walletRow({ id: "bca", archivedAt: null }),
    );
    vi.mocked(repo.setPrimary).mockResolvedValue([{ count: 1 }, { count: 1 }]);

    await service.setPrimaryWallet("u1", "bca");

    expect(repo.setPrimary).toHaveBeenCalledWith("u1", "bca");
  });

  it("rejects a missing wallet", async () => {
    vi.mocked(repo.findById).mockResolvedValue(null);

    await expect(service.setPrimaryWallet("u1", "x")).rejects.toBeInstanceOf(
      DomainError,
    );
    expect(repo.setPrimary).not.toHaveBeenCalled();
  });

  it("rejects an archived wallet", async () => {
    vi.mocked(repo.findById).mockResolvedValue(
      walletRow({ id: "old", archivedAt: new Date() }),
    );

    await expect(service.setPrimaryWallet("u1", "old")).rejects.toBeInstanceOf(
      DomainError,
    );
    expect(repo.setPrimary).not.toHaveBeenCalled();
  });
});

describe("adjustBalance", () => {
  const fixedNow = new Date("2026-06-06T05:00:00.000Z");

  it("records a positive signed adjustment to reach the target", async () => {
    vi.mocked(repo.findById).mockResolvedValue(
      walletRow({ id: "bca", startingBalance: 1_000_000 }),
    );
    vi.mocked(movementsRepo.listActualByWallet).mockResolvedValue([]);
    vi.mocked(movementsRepo.create).mockResolvedValue(walletRow({}) as never);

    await service.adjustBalance(
      "u1",
      "bca",
      { targetBalance: 1_200_000 },
      fixedNow,
    );

    expect(movementsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        walletId: "bca",
        type: MovementType.ADJUSTMENT,
        status: MovementStatus.ACTUAL,
        amount: 200_000,
        categoryId: null,
        paymentMethod: null,
        effectiveDate: toCycleDate(fixedNow),
      }),
    );
  });

  it("records a negative adjustment", async () => {
    vi.mocked(repo.findById).mockResolvedValue(
      walletRow({ id: "bca", startingBalance: 1_000_000 }),
    );
    vi.mocked(movementsRepo.listActualByWallet).mockResolvedValue([]);
    vi.mocked(movementsRepo.create).mockResolvedValue(walletRow({}) as never);

    await service.adjustBalance("u1", "bca", { targetBalance: 800_000 });

    expect(movementsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: -200_000 }),
    );
  });

  it("does nothing when already at the target", async () => {
    vi.mocked(repo.findById).mockResolvedValue(
      walletRow({ id: "bca", startingBalance: 1_000_000 }),
    );
    vi.mocked(movementsRepo.listActualByWallet).mockResolvedValue([]);

    await service.adjustBalance("u1", "bca", { targetBalance: 1_000_000 });

    expect(movementsRepo.create).not.toHaveBeenCalled();
  });

  it("rejects adjusting a missing wallet", async () => {
    vi.mocked(repo.findById).mockResolvedValue(null);

    await expect(
      service.adjustBalance("u1", "x", { targetBalance: 1 }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("restoreWallet", () => {
  it("restores an archived wallet", async () => {
    vi.mocked(repo.restore).mockResolvedValue({ count: 1 });

    await service.restoreWallet("u1", "gopay");

    expect(repo.restore).toHaveBeenCalledWith("gopay", "u1");
  });

  it("rejects restoring a missing wallet", async () => {
    vi.mocked(repo.restore).mockResolvedValue({ count: 0 });

    await expect(service.restoreWallet("u1", "x")).rejects.toBeInstanceOf(
      DomainError,
    );
  });
});

describe("removeWallet", () => {
  it("blocks removing the primary wallet", async () => {
    vi.mocked(repo.findById).mockResolvedValue(
      walletRow({ id: "bca", isPrimary: true }),
    );

    await expect(service.removeWallet("u1", "bca")).rejects.toBeInstanceOf(
      DomainError,
    );
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it("hard-deletes a fresh wallet", async () => {
    vi.mocked(repo.findById).mockResolvedValue(
      walletRow({ id: "cash", isPrimary: false }),
    );
    vi.mocked(repo.remove).mockResolvedValue({ count: 1 });

    const result = await service.removeWallet("u1", "cash");

    expect(result).toEqual({ archived: false });
    expect(repo.archive).not.toHaveBeenCalled();
  });

  it("archives a wallet that still has history (P2003) instead of deleting", async () => {
    vi.mocked(repo.findById).mockResolvedValue(
      walletRow({ id: "cash", isPrimary: false }),
    );
    vi.mocked(repo.remove).mockRejectedValue({ code: "P2003" });
    vi.mocked(repo.archive).mockResolvedValue({ count: 1 });

    const result = await service.removeWallet("u1", "cash");

    expect(result).toEqual({ archived: true });
    expect(repo.archive).toHaveBeenCalled();
  });

  it("rejects removing a missing wallet", async () => {
    vi.mocked(repo.findById).mockResolvedValue(null);

    await expect(service.removeWallet("u1", "x")).rejects.toBeInstanceOf(
      DomainError,
    );
  });
});
