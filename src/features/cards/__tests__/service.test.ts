import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Card } from "@/generated/prisma/client";
import { CardKind } from "@/generated/prisma/enums";
import { DomainError } from "@/lib/errors";

vi.mock("../repository");
// Cross-entity ownership is exercised by its own tests (shared/ownership) — here
// it's a no-op so these service tests stay focused on card logic.
vi.mock("@/features/shared/ownership");

import * as repo from "../repository";
import * as service from "../service";

const card = (over: Record<string, unknown>): Card =>
  ({
    id: "card",
    userId: "u1",
    name: "CC BCA",
    kind: CardKind.CREDIT_CARD,
    defaultDueDay: 3,
    payingWalletId: "bca",
    archivedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...over,
  }) as unknown as Card;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createCard", () => {
  it("creates a card", async () => {
    vi.mocked(repo.create).mockResolvedValue(card({}));

    await service.createCard("u1", {
      name: "CC BCA",
      kind: CardKind.CREDIT_CARD,
      defaultDueDay: 3,
      payingWalletId: "bca",
    });

    expect(repo.create).toHaveBeenCalledWith("u1", {
      name: "CC BCA",
      kind: CardKind.CREDIT_CARD,
      defaultDueDay: 3,
      payingWalletId: "bca",
    });
  });
});

describe("updateCard", () => {
  it("rejects a missing card", async () => {
    vi.mocked(repo.update).mockResolvedValue({ count: 0 });

    await expect(
      service.updateCard("u1", "x", {
        name: "X",
        kind: CardKind.PAYLATER,
        defaultDueDay: 1,
        payingWalletId: "bca",
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("removeCard", () => {
  it("hard-deletes a fresh card", async () => {
    vi.mocked(repo.findById).mockResolvedValue(card({ id: "c1" }));
    vi.mocked(repo.remove).mockResolvedValue({ count: 1 });

    const result = await service.removeCard("u1", "c1");

    expect(result).toEqual({ archived: false });
    expect(repo.archive).not.toHaveBeenCalled();
  });

  it("archives a card still in use (P2003)", async () => {
    vi.mocked(repo.findById).mockResolvedValue(card({ id: "c1" }));
    vi.mocked(repo.remove).mockRejectedValue({ code: "P2003" });
    vi.mocked(repo.archive).mockResolvedValue({ count: 1 });

    const result = await service.removeCard("u1", "c1");

    expect(result).toEqual({ archived: true });
    expect(repo.archive).toHaveBeenCalled();
  });

  it("rejects a missing card", async () => {
    vi.mocked(repo.findById).mockResolvedValue(null);

    await expect(service.removeCard("u1", "x")).rejects.toBeInstanceOf(
      DomainError,
    );
  });
});
