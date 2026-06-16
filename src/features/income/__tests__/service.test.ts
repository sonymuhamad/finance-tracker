import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Movement, RecurringRule } from "@/generated/prisma/client";
import { MovementStatus, MovementType } from "@/generated/prisma/enums";
import { toCycleDate } from "@/lib/cycle";
import { DomainError } from "@/lib/errors";

// Mock the I/O boundaries; cycle + projection (pure) run for real.
vi.mock("@/features/recurring/service");
vi.mock("@/features/recurring/repository");
vi.mock("@/features/movements/service");
vi.mock("@/features/movements/repository");
// Cross-entity ownership has its own tests (shared/ownership); no-op here.
vi.mock("@/features/shared/ownership");

import * as movementsRepo from "@/features/movements/repository";
import * as movements from "@/features/movements/service";
import * as recurringRepo from "@/features/recurring/repository";
import * as recurring from "@/features/recurring/service";
import * as service from "../service";

const rule = (over: Record<string, unknown>): RecurringRule =>
  ({
    id: "rule",
    userId: "u1",
    type: MovementType.INCOME,
    amount: 10_000_000,
    dayOfMonth: 25,
    walletId: "bca",
    cardId: null,
    categoryId: "gaji",
    isPrimaryIncome: false,
    note: null,
    startsOn: new Date("2026-01-01"),
    endedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...over,
  }) as unknown as RecurringRule;

const movementRow = (over: Record<string, unknown>): Movement =>
  ({
    id: "m",
    userId: "u1",
    type: MovementType.INCOME,
    status: MovementStatus.ACTUAL,
    amount: 1_000_000,
    walletId: "bca",
    cardId: null,
    categoryId: null,
    paymentMethod: null,
    occurredAt: new Date("2026-06-26"),
    effectiveDate: new Date("2026-06-26"),
    note: null,
    recurringRuleId: null,
    confirmedAt: new Date("2026-06-26"),
    createdAt: new Date("2026-06-26"),
    updatedAt: new Date("2026-06-26"),
    ...over,
  }) as unknown as Movement;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setPrimaryIncome", () => {
  const input = {
    amount: 12_000_000,
    dayOfMonth: 25,
    walletId: "bca",
    categoryId: "gaji",
  };

  it("creates a primary income rule when none exists", async () => {
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(null);
    vi.mocked(recurring.createRule).mockResolvedValue(rule({}));

    await service.setPrimaryIncome("u1", input);

    expect(recurring.createRule).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        type: MovementType.INCOME,
        isPrimaryIncome: true,
        amount: 12_000_000,
        dayOfMonth: 25,
        walletId: "bca",
      }),
    );
    expect(recurring.updateRule).not.toHaveBeenCalled();
  });

  it("updates the existing primary income in place (no second primary)", async () => {
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(
      rule({ id: "existing", isPrimaryIncome: true }),
    );
    vi.mocked(recurring.updateRule).mockResolvedValue(undefined);

    await service.setPrimaryIncome("u1", input);

    expect(recurring.updateRule).toHaveBeenCalledWith(
      "existing",
      "u1",
      expect.objectContaining({ amount: 12_000_000, dayOfMonth: 25 }),
    );
    expect(recurring.createRule).not.toHaveBeenCalled();
  });
});

describe("addOneOffIncome", () => {
  const base = {
    amount: 2_000_000,
    date: new Date("2026-06-20"),
    walletId: "bca",
    categoryId: "side",
  };

  it("records received income as an ACTUAL movement", async () => {
    vi.mocked(movements.createMovement).mockResolvedValue(movementRow({}));

    await service.addOneOffIncome("u1", { ...base, received: true });

    expect(movements.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MovementType.INCOME,
        status: MovementStatus.ACTUAL,
        amount: 2_000_000,
        walletId: "bca",
        effectiveDate: toCycleDate(base.date),
        confirmedAt: expect.any(Date),
      }),
    );
  });

  it("records expected income as a PLANNED movement (not confirmed)", async () => {
    vi.mocked(movements.createMovement).mockResolvedValue(movementRow({}));

    await service.addOneOffIncome("u1", { ...base, received: false });

    expect(movements.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MovementStatus.PLANNED,
        confirmedAt: null,
      }),
    );
  });
});

describe("updateIncome", () => {
  it("edits a one-off expected (PLANNED) income movement", async () => {
    vi.mocked(movementsRepo.findById).mockResolvedValue(
      movementRow({
        id: "m1",
        recurringRuleId: null,
        status: MovementStatus.PLANNED,
      }),
    );
    vi.mocked(movements.updateMovement).mockResolvedValue({
      count: 1,
    } as never);

    await service.updateIncome("u1", {
      movementId: "m1",
      amount: 3_000_000,
      date: new Date("2026-06-20"),
      categoryId: "side",
      note: "bonus",
    });

    expect(movements.updateMovement).toHaveBeenCalledWith(
      "m1",
      "u1",
      expect.objectContaining({
        amount: 3_000_000,
        categoryId: "side",
        note: "bonus",
        effectiveDate: toCycleDate(new Date("2026-06-20")),
      }),
    );
  });

  it("rejects editing a recurring-materialized income", async () => {
    vi.mocked(movementsRepo.findById).mockResolvedValue(
      movementRow({
        id: "m1",
        recurringRuleId: "primary",
        status: MovementStatus.PLANNED,
      }),
    );

    await expect(
      service.updateIncome("u1", {
        movementId: "m1",
        amount: 1,
        date: new Date("2026-06-20"),
      }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(movements.updateMovement).not.toHaveBeenCalled();
  });

  it("rejects editing a received (ACTUAL) income — locked once received", async () => {
    vi.mocked(movementsRepo.findById).mockResolvedValue(
      movementRow({
        id: "m1",
        recurringRuleId: null,
        status: MovementStatus.ACTUAL,
      }),
    );

    await expect(
      service.updateIncome("u1", {
        movementId: "m1",
        amount: 1,
        date: new Date("2026-06-20"),
      }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(movements.updateMovement).not.toHaveBeenCalled();
  });
});

describe("deleteIncome", () => {
  it("deletes a one-off expected (PLANNED) income movement", async () => {
    vi.mocked(movementsRepo.findById).mockResolvedValue(
      movementRow({
        id: "m1",
        recurringRuleId: null,
        status: MovementStatus.PLANNED,
      }),
    );
    vi.mocked(movements.deleteMovement).mockResolvedValue({
      count: 1,
    } as never);

    await service.deleteIncome("u1", "m1");

    expect(movements.deleteMovement).toHaveBeenCalledWith("m1", "u1");
  });

  it("rejects deleting a received (ACTUAL) income — locked once received", async () => {
    vi.mocked(movementsRepo.findById).mockResolvedValue(
      movementRow({
        id: "m1",
        recurringRuleId: null,
        status: MovementStatus.ACTUAL,
      }),
    );

    await expect(service.deleteIncome("u1", "m1")).rejects.toBeInstanceOf(
      DomainError,
    );
    expect(movements.deleteMovement).not.toHaveBeenCalled();
  });
});

describe("confirmIncome", () => {
  const primary = () =>
    rule({ id: "primary", isPrimaryIncome: true, dayOfMonth: 25 });

  it("flips a planned one-off income to actual", async () => {
    vi.mocked(movementsRepo.findById).mockResolvedValue(
      movementRow({ id: "m1", effectiveDate: new Date("2026-06-26") }),
    );
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(primary());
    vi.mocked(movements.confirmMovement).mockResolvedValue({
      count: 1,
    } as never);

    await service.confirmIncome(
      "u1",
      { movementId: "m1" },
      new Date("2026-06-26"),
    );

    expect(movements.confirmMovement).toHaveBeenCalledWith(
      "m1",
      "u1",
      expect.any(Object),
    );
  });

  it("rejects when nothing was flipped (already confirmed / not found)", async () => {
    vi.mocked(movementsRepo.findById).mockResolvedValue(
      movementRow({ id: "m1", effectiveDate: new Date("2026-06-26") }),
    );
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(primary());
    vi.mocked(movements.confirmMovement).mockResolvedValue({
      count: 0,
    } as never);

    await expect(
      service.confirmIncome("u1", { movementId: "m1" }, new Date("2026-06-26")),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("rejects receiving income that belongs to a future cycle", async () => {
    vi.mocked(movementsRepo.findById).mockResolvedValue(
      movementRow({ id: "m1", effectiveDate: new Date("2026-07-25") }),
    );
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(primary());

    await expect(
      service.confirmIncome("u1", { movementId: "m1" }, new Date("2026-06-26")),
    ).rejects.toBeInstanceOf(DomainError);
    expect(movements.confirmMovement).not.toHaveBeenCalled();
  });
});

describe("confirmRecurringIncome", () => {
  it("materializes a projected occurrence as an ACTUAL movement carrying the rule", async () => {
    vi.mocked(recurringRepo.findById).mockResolvedValue(
      rule({
        id: "r1",
        amount: 10_000_000,
        walletId: "bca",
        categoryId: "gaji",
      }),
    );
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(
      rule({ id: "primary", isPrimaryIncome: true, dayOfMonth: 25 }),
    );
    vi.mocked(movementsRepo.findByRuleOnDate).mockResolvedValue(null);
    vi.mocked(movements.createMovement).mockResolvedValue(movementRow({}));

    await service.confirmRecurringIncome(
      "u1",
      { ruleId: "r1", occurrenceDate: new Date("2026-06-25") },
      new Date("2026-06-26"),
    );

    expect(movements.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MovementType.INCOME,
        status: MovementStatus.ACTUAL,
        recurringRuleId: "r1",
        amount: 10_000_000,
        walletId: "bca",
        effectiveDate: toCycleDate(new Date("2026-06-25")),
      }),
    );
  });

  it("rejects a missing / non-income rule", async () => {
    vi.mocked(recurringRepo.findById).mockResolvedValue(null);

    await expect(
      service.confirmRecurringIncome("u1", {
        ruleId: "x",
        occurrenceDate: new Date("2026-06-25"),
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("rejects a duplicate confirm (occurrence already materialized this cycle)", async () => {
    vi.mocked(recurringRepo.findById).mockResolvedValue(rule({ id: "r1" }));
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(
      rule({ id: "primary", isPrimaryIncome: true, dayOfMonth: 25 }),
    );
    vi.mocked(movementsRepo.findByRuleOnDate).mockResolvedValue(
      movementRow({ id: "dup" }),
    );

    await expect(
      service.confirmRecurringIncome(
        "u1",
        { ruleId: "r1", occurrenceDate: new Date("2026-06-25") },
        new Date("2026-06-26"),
      ),
    ).rejects.toBeInstanceOf(DomainError);
    expect(movements.createMovement).not.toHaveBeenCalled();
  });
});

describe("listIncome", () => {
  it("falls back to calendar months and flags no primary income", async () => {
    vi.mocked(recurring.getCycleAnchorDay).mockResolvedValue(1);
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(null);
    vi.mocked(movementsRepo.listByUserInWindow).mockResolvedValue([]);
    vi.mocked(recurring.listActiveRules).mockResolvedValue([]);

    const view = await service.listIncome("u1", 0, new Date("2026-06-15"));

    expect(view.hasPrimaryIncome).toBe(false);
    expect(view.cycle.label).toContain("Jun");
  });

  it("combines received + expected + projected, excluding a materialized rule", async () => {
    const primary = rule({
      id: "primary",
      isPrimaryIncome: true,
      dayOfMonth: 25,
    });
    const secondary = rule({ id: "secondary", dayOfMonth: 10 });

    vi.mocked(recurring.getCycleAnchorDay).mockResolvedValue(25);
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(primary);
    vi.mocked(recurring.listActiveRules).mockResolvedValue([
      primary,
      secondary,
    ]);
    // Window holds: the materialized primary (ACTUAL, links to primary rule) and
    // an expected one-off (PLANNED, no rule).
    vi.mocked(movementsRepo.listByUserInWindow).mockResolvedValue([
      movementRow({
        id: "m-primary",
        status: MovementStatus.ACTUAL,
        recurringRuleId: "primary",
        effectiveDate: new Date("2026-06-25"),
      }),
      movementRow({
        id: "m-oneoff",
        status: MovementStatus.PLANNED,
        recurringRuleId: null,
        effectiveDate: new Date("2026-06-28"),
      }),
    ]);

    const view = await service.listIncome("u1", 0, new Date("2026-06-26"));

    const projected = view.items.filter((i) => i.kind === "projected");
    // Only the secondary rule projects — the primary is already materialized.
    expect(projected).toHaveLength(1);
    expect(projected[0]?.ruleId).toBe("secondary");
    expect(view.items.some((i) => i.kind === "received")).toBe(true);
    expect(view.items.some((i) => i.kind === "expected")).toBe(true);
    expect(view.recurringSources.map((r) => r.id)).toEqual(["secondary"]);
  });
});
