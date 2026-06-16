import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Card, Category, Wallet } from "@/generated/prisma/client";
import { DomainError } from "@/lib/errors";

vi.mock("@/features/wallets/repository");
vi.mock("@/features/cards/repository");
vi.mock("@/features/categories/repository");

import * as cardsRepo from "@/features/cards/repository";
import * as categoriesRepo from "@/features/categories/repository";
import * as walletsRepo from "@/features/wallets/repository";
import { assertOwned } from "../ownership";

const owned = (id: string) => ({ id }) as unknown as Wallet & Card & Category;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("assertOwned", () => {
  it("passes when every referenced entity belongs to the user", async () => {
    vi.mocked(walletsRepo.findById).mockResolvedValue(owned("w1"));
    vi.mocked(cardsRepo.findById).mockResolvedValue(owned("c1"));
    vi.mocked(categoriesRepo.findById).mockResolvedValue(owned("cat1"));

    await expect(
      assertOwned("u1", { walletId: "w1", cardId: "c1", categoryId: "cat1" }),
    ).resolves.toBeUndefined();

    // Ownership lookups are always scoped to the caller's userId.
    expect(walletsRepo.findById).toHaveBeenCalledWith("w1", "u1");
    expect(cardsRepo.findById).toHaveBeenCalledWith("c1", "u1");
    expect(categoriesRepo.findById).toHaveBeenCalledWith("cat1", "u1");
  });

  it("skips lookups for ids that aren't provided", async () => {
    await assertOwned("u1", {});

    expect(walletsRepo.findById).not.toHaveBeenCalled();
    expect(cardsRepo.findById).not.toHaveBeenCalled();
    expect(categoriesRepo.findById).not.toHaveBeenCalled();
  });

  // The core IDOR guard: a scoped finder returns null for another user's row.
  it("rejects a wallet the user doesn't own", async () => {
    vi.mocked(walletsRepo.findById).mockResolvedValue(null);

    await expect(
      assertOwned("attacker", { walletId: "victim-wallet" }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("rejects a card the user doesn't own", async () => {
    vi.mocked(cardsRepo.findById).mockResolvedValue(null);

    await expect(
      assertOwned("attacker", { cardId: "victim-card" }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("rejects a category the user doesn't own", async () => {
    vi.mocked(categoriesRepo.findById).mockResolvedValue(null);

    await expect(
      assertOwned("attacker", { categoryId: "victim-category" }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
