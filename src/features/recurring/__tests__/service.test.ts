import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

vi.mock("../repository");

import * as repo from "../repository";
import * as service from "../service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateRule", () => {
  it("updates a rule's editable fields", async () => {
    vi.mocked(repo.update).mockResolvedValue({ count: 1 });

    await service.updateRule("r1", "u1", { amount: 100, dayOfMonth: 25 });

    expect(repo.update).toHaveBeenCalledWith("r1", "u1", {
      amount: 100,
      dayOfMonth: 25,
    });
  });

  it("rejects a missing rule", async () => {
    vi.mocked(repo.update).mockResolvedValue({ count: 0 });

    await expect(
      service.updateRule("x", "u1", { amount: 100 }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("endRule", () => {
  it("ends a rule that exists", async () => {
    vi.mocked(repo.end).mockResolvedValue({ count: 1 });

    await service.endRule("r1", "u1");

    expect(repo.end).toHaveBeenCalledWith("r1", "u1", expect.any(Date));
  });

  it("rejects ending a missing rule instead of a phantom success", async () => {
    vi.mocked(repo.end).mockResolvedValue({ count: 0 });

    await expect(service.endRule("x", "u1")).rejects.toBeInstanceOf(
      DomainError,
    );
  });
});

describe("getCycleAnchorDay", () => {
  it("returns the primary income's day-of-month", async () => {
    vi.mocked(repo.findPrimaryIncome).mockResolvedValue({
      dayOfMonth: 25,
    } as never);

    expect(await service.getCycleAnchorDay("u1")).toBe(25);
  });

  it("falls back to 1 (calendar months) when there is no primary income", async () => {
    vi.mocked(repo.findPrimaryIncome).mockResolvedValue(null);

    expect(await service.getCycleAnchorDay("u1")).toBe(1);
  });
});
