import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Card, Movement, RecurringRule } from "@/generated/prisma/client";
import {
  MovementStatus,
  MovementType,
  PaymentMethod,
} from "@/generated/prisma/enums";
import { toCycleDate } from "@/lib/cycle";
import { DomainError } from "@/lib/errors";
import { nextDueDate } from "../timing";
import type { ExpenseItem } from "../types";

vi.mock("@/features/cards/repository");
vi.mock("@/features/recurring/service");
vi.mock("@/features/recurring/repository");
vi.mock("@/features/movements/service");
vi.mock("@/features/movements/repository");
// Cross-entity ownership has its own tests (shared/ownership); no-op here.
vi.mock("@/features/shared/ownership");

import * as cardsRepo from "@/features/cards/repository";
import * as movementsRepo from "@/features/movements/repository";
import * as movements from "@/features/movements/service";
import * as recurringRepo from "@/features/recurring/repository";
import * as recurring from "@/features/recurring/service";
import * as service from "../service";

const card = (over: Record<string, unknown>): Card =>
  ({
    id: "c1",
    userId: "u1",
    name: "CC BCA",
    kind: "CREDIT_CARD",
    defaultDueDay: 3,
    payingWalletId: "bca",
    archivedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...over,
  }) as unknown as Card;

const rule = (over: Record<string, unknown>): RecurringRule =>
  ({
    id: "rule",
    userId: "u1",
    type: MovementType.EXPENSE,
    amount: 1_500_000,
    dayOfMonth: 5,
    walletId: "bca",
    cardId: null,
    categoryId: "tagihan",
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
    type: MovementType.EXPENSE,
    status: MovementStatus.ACTUAL,
    amount: 100_000,
    walletId: "bca",
    cardId: null,
    categoryId: "makan",
    paymentMethod: PaymentMethod.CASH,
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

describe("recordExpense", () => {
  it("records a cash expense as ACTUAL on the transaction date", async () => {
    vi.mocked(movements.createMovement).mockResolvedValue(movementRow({}));

    await service.recordExpense("u1", {
      amount: 100_000,
      date: new Date("2026-06-05"),
      method: PaymentMethod.CASH,
      walletId: "bca",
      categoryId: "makan",
    });

    expect(movements.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MovementType.EXPENSE,
        status: MovementStatus.ACTUAL,
        paymentMethod: PaymentMethod.CASH,
        amount: 100_000,
        walletId: "bca",
        cardId: null,
        effectiveDate: toCycleDate(new Date("2026-06-05")),
      }),
    );
  });

  it("records a credit-card expense as a PLANNED obligation due on the card's day", async () => {
    vi.mocked(cardsRepo.findById).mockResolvedValue(
      card({ id: "c1", defaultDueDay: 3, payingWalletId: "bca" }),
    );
    vi.mocked(movements.createMovement).mockResolvedValue(movementRow({}));

    await service.recordExpense("u1", {
      amount: 750_000,
      date: new Date("2026-06-05"),
      method: PaymentMethod.CREDIT_CARD,
      cardId: "c1",
    });

    expect(movements.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MovementType.EXPENSE,
        status: MovementStatus.PLANNED,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        walletId: "bca", // the card's paying wallet
        cardId: "c1",
        // due day 3 already passed on Jun 5 → next is Jul 3
        effectiveDate: toCycleDate(nextDueDate(3, new Date("2026-06-05"))),
      }),
    );
  });

  it("honors an explicit due date override", async () => {
    vi.mocked(cardsRepo.findById).mockResolvedValue(card({ id: "c1" }));
    vi.mocked(movements.createMovement).mockResolvedValue(movementRow({}));

    await service.recordExpense("u1", {
      amount: 500_000,
      date: new Date("2026-06-05"),
      method: PaymentMethod.PAYLATER,
      cardId: "c1",
      dueDate: new Date("2026-06-20"),
    });

    expect(movements.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MovementStatus.PLANNED,
        effectiveDate: toCycleDate(new Date("2026-06-20")),
      }),
    );
  });

  it("rejects a card expense whose card is missing", async () => {
    vi.mocked(cardsRepo.findById).mockResolvedValue(null);

    await expect(
      service.recordExpense("u1", {
        amount: 100_000,
        date: new Date("2026-06-05"),
        method: PaymentMethod.CREDIT_CARD,
        cardId: "gone",
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("records a planned (future) cash expense as PLANNED when paid is false", async () => {
    vi.mocked(movements.createMovement).mockResolvedValue(movementRow({}));

    await service.recordExpense("u1", {
      amount: 200_000,
      date: new Date("2026-07-10"),
      method: PaymentMethod.CASH,
      walletId: "bca",
      paid: false,
    });

    expect(movements.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MovementStatus.PLANNED,
        paymentMethod: PaymentMethod.CASH,
        walletId: "bca",
        cardId: null,
        effectiveDate: toCycleDate(new Date("2026-07-10")),
      }),
    );
  });

  it("forces a future-cycle cash expense to PLANNED even when marked paid", async () => {
    // Can't have "already paid" cash for a cycle that hasn't started — else a
    // future-dated ACTUAL would cut today's balance.
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(
      rule({ id: "primary", type: MovementType.INCOME, dayOfMonth: 25 }),
    );
    vi.mocked(movements.createMovement).mockResolvedValue(movementRow({}));

    await service.recordExpense(
      "u1",
      {
        amount: 200_000,
        date: new Date("2026-07-25"), // next cycle (anchor 25, now 26 Jun)
        method: PaymentMethod.CASH,
        walletId: "bca",
        paid: true,
      },
      new Date("2026-06-26"),
    );

    expect(movements.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MovementStatus.PLANNED,
        paymentMethod: PaymentMethod.CASH,
        effectiveDate: toCycleDate(new Date("2026-07-25")),
      }),
    );
  });

  it("keeps a current-cycle paid cash expense ACTUAL", async () => {
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(
      rule({ id: "primary", type: MovementType.INCOME, dayOfMonth: 25 }),
    );
    vi.mocked(movements.createMovement).mockResolvedValue(movementRow({}));

    await service.recordExpense(
      "u1",
      {
        amount: 100_000,
        date: new Date("2026-06-30"), // current cycle (25 Jun – 24 Jul)
        method: PaymentMethod.CASH,
        walletId: "bca",
        paid: true,
      },
      new Date("2026-06-26"),
    );

    expect(movements.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({ status: MovementStatus.ACTUAL }),
    );
  });
});

describe("addRecurringObligation", () => {
  it("creates an EXPENSE recurring rule", async () => {
    vi.mocked(recurring.createRule).mockResolvedValue(rule({}));

    await service.addRecurringObligation("u1", {
      amount: 800_000,
      dayOfMonth: 10,
      walletId: "bca",
      categoryId: "tagihan",
    });

    expect(recurring.createRule).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MovementType.EXPENSE,
        amount: 800_000,
        dayOfMonth: 10,
        walletId: "bca",
        isPrimaryIncome: false,
      }),
    );
  });
});

describe("confirmObligation", () => {
  const primary = () =>
    rule({ id: "primary", type: MovementType.INCOME, dayOfMonth: 25 });

  it("rejects when nothing was flipped (already paid / not found)", async () => {
    vi.mocked(movementsRepo.findById).mockResolvedValue(
      movementRow({ id: "m1", effectiveDate: new Date("2026-06-26") }),
    );
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(primary());
    vi.mocked(movements.confirmMovement).mockResolvedValue({
      count: 0,
    } as never);

    await expect(
      service.confirmObligation(
        "u1",
        { movementId: "m1" },
        new Date("2026-06-26"),
      ),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("rejects paying an obligation that belongs to a future cycle", async () => {
    vi.mocked(movementsRepo.findById).mockResolvedValue(
      // due 25 Jul — the cycle after the one containing 26 Jun (anchor 25)
      movementRow({ id: "m1", effectiveDate: new Date("2026-07-25") }),
    );
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(primary());

    await expect(
      service.confirmObligation(
        "u1",
        { movementId: "m1" },
        new Date("2026-06-26"),
      ),
    ).rejects.toBeInstanceOf(DomainError);
    expect(movements.confirmMovement).not.toHaveBeenCalled();
  });

  it("allows paying an obligation in the current cycle", async () => {
    vi.mocked(movementsRepo.findById).mockResolvedValue(
      movementRow({ id: "m1", effectiveDate: new Date("2026-06-30") }),
    );
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(primary());
    vi.mocked(movements.confirmMovement).mockResolvedValue({
      count: 1,
    } as never);

    await service.confirmObligation(
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
});

describe("confirmRecurringObligation", () => {
  it("materializes an ACTUAL expense from its paying wallet", async () => {
    vi.mocked(recurringRepo.findById).mockResolvedValue(
      rule({ id: "r1", walletId: "bca", cardId: "c1", amount: 1_500_000 }),
    );
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(
      rule({ id: "primary", type: MovementType.INCOME, dayOfMonth: 25 }),
    );
    vi.mocked(movementsRepo.findByRuleOnDate).mockResolvedValue(null);
    vi.mocked(movements.createMovement).mockResolvedValue(movementRow({}));

    await service.confirmRecurringObligation(
      "u1",
      { ruleId: "r1", occurrenceDate: new Date("2026-06-05") },
      new Date("2026-06-10"),
    );

    expect(movements.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MovementType.EXPENSE,
        status: MovementStatus.ACTUAL,
        recurringRuleId: "r1",
        amount: 1_500_000,
        walletId: "bca",
        cardId: "c1",
        effectiveDate: toCycleDate(new Date("2026-06-05")),
      }),
    );
  });

  it("rejects a duplicate confirm", async () => {
    vi.mocked(recurringRepo.findById).mockResolvedValue(rule({ id: "r1" }));
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(
      rule({ id: "primary", type: MovementType.INCOME, dayOfMonth: 25 }),
    );
    vi.mocked(movementsRepo.findByRuleOnDate).mockResolvedValue(
      movementRow({ id: "dup" }),
    );

    await expect(
      service.confirmRecurringObligation(
        "u1",
        { ruleId: "r1", occurrenceDate: new Date("2026-06-05") },
        new Date("2026-06-10"),
      ),
    ).rejects.toBeInstanceOf(DomainError);
    expect(movements.createMovement).not.toHaveBeenCalled();
  });

  it("rejects materializing an occurrence in a future cycle", async () => {
    vi.mocked(recurringRepo.findById).mockResolvedValue(rule({ id: "r1" }));
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(
      rule({ id: "primary", type: MovementType.INCOME, dayOfMonth: 25 }),
    );

    await expect(
      service.confirmRecurringObligation(
        "u1",
        { ruleId: "r1", occurrenceDate: new Date("2026-07-25") },
        new Date("2026-06-26"),
      ),
    ).rejects.toBeInstanceOf(DomainError);
    expect(movements.createMovement).not.toHaveBeenCalled();
  });
});

describe("updateExpense", () => {
  it("edits a one-off PLANNED expense (amount/category/note/date)", async () => {
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

    await service.updateExpense("u1", {
      movementId: "m1",
      amount: 300_000,
      date: new Date("2026-06-10"),
      categoryId: "makan",
      note: "revisi",
    });

    expect(movements.updateMovement).toHaveBeenCalledWith(
      "m1",
      "u1",
      expect.objectContaining({
        amount: 300_000,
        categoryId: "makan",
        note: "revisi",
        effectiveDate: toCycleDate(new Date("2026-06-10")),
      }),
    );
  });

  it("rejects editing a recurring-materialized movement", async () => {
    vi.mocked(movementsRepo.findById).mockResolvedValue(
      movementRow({
        id: "m1",
        recurringRuleId: "rule",
        status: MovementStatus.PLANNED,
      }),
    );

    await expect(
      service.updateExpense("u1", {
        movementId: "m1",
        amount: 1,
        date: new Date("2026-06-10"),
      }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(movements.updateMovement).not.toHaveBeenCalled();
  });

  it("rejects editing a paid (ACTUAL) expense — locked once paid", async () => {
    vi.mocked(movementsRepo.findById).mockResolvedValue(
      movementRow({
        id: "m1",
        recurringRuleId: null,
        status: MovementStatus.ACTUAL,
      }),
    );

    await expect(
      service.updateExpense("u1", {
        movementId: "m1",
        amount: 1,
        date: new Date("2026-06-10"),
      }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(movements.updateMovement).not.toHaveBeenCalled();
  });

  it("rejects editing an income movement through the expense path", async () => {
    vi.mocked(movementsRepo.findById).mockResolvedValue(
      movementRow({
        id: "m1",
        type: MovementType.INCOME,
        status: MovementStatus.PLANNED,
      }),
    );

    await expect(
      service.updateExpense("u1", {
        movementId: "m1",
        amount: 1,
        date: new Date("2026-06-10"),
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("deleteExpense", () => {
  it("deletes a one-off PLANNED expense", async () => {
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

    await service.deleteExpense("u1", "m1");

    expect(movements.deleteMovement).toHaveBeenCalledWith("m1", "u1");
  });

  it("rejects deleting a paid (ACTUAL) expense — locked once paid", async () => {
    vi.mocked(movementsRepo.findById).mockResolvedValue(
      movementRow({
        id: "m1",
        recurringRuleId: null,
        status: MovementStatus.ACTUAL,
      }),
    );

    await expect(service.deleteExpense("u1", "m1")).rejects.toBeInstanceOf(
      DomainError,
    );
    expect(movements.deleteMovement).not.toHaveBeenCalled();
  });
});

describe("per-occurrence overrides", () => {
  const rec = () =>
    rule({
      id: "r1",
      walletId: "bca",
      categoryId: "tagihan",
      amount: 1_500_000,
    });

  it("adjustObligationOccurrence materializes a PLANNED override when none exists", async () => {
    vi.mocked(recurringRepo.findById).mockResolvedValue(rec());
    vi.mocked(movementsRepo.findByRuleOnDate).mockResolvedValue(null);
    vi.mocked(movements.createMovement).mockResolvedValue(movementRow({}));

    await service.adjustObligationOccurrence("u1", {
      ruleId: "r1",
      occurrenceDate: new Date("2026-07-25"),
      amount: 2_000_000,
    });

    expect(movements.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MovementType.EXPENSE,
        status: MovementStatus.PLANNED,
        recurringRuleId: "r1",
        amount: 2_000_000,
        walletId: "bca",
        effectiveDate: toCycleDate(new Date("2026-07-25")),
      }),
    );
  });

  it("adjustObligationOccurrence updates an existing (un-skips + re-amounts)", async () => {
    vi.mocked(recurringRepo.findById).mockResolvedValue(rec());
    vi.mocked(movementsRepo.findByRuleOnDate).mockResolvedValue(
      movementRow({ id: "occ", status: MovementStatus.SKIPPED }),
    );
    vi.mocked(movements.updateMovement).mockResolvedValue({
      count: 1,
    } as never);

    await service.adjustObligationOccurrence("u1", {
      ruleId: "r1",
      occurrenceDate: new Date("2026-07-25"),
      amount: 2_000_000,
    });

    expect(movements.updateMovement).toHaveBeenCalledWith(
      "occ",
      "u1",
      expect.objectContaining({
        amount: 2_000_000,
        status: MovementStatus.PLANNED,
      }),
    );
  });

  it("skipObligationOccurrence materializes a SKIPPED marker", async () => {
    vi.mocked(recurringRepo.findById).mockResolvedValue(rec());
    vi.mocked(movementsRepo.findByRuleOnDate).mockResolvedValue(null);
    vi.mocked(movements.createMovement).mockResolvedValue(movementRow({}));

    await service.skipObligationOccurrence("u1", {
      ruleId: "r1",
      occurrenceDate: new Date("2026-07-25"),
    });

    expect(movements.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MovementStatus.SKIPPED,
        recurringRuleId: "r1",
        amount: 1_500_000,
      }),
    );
  });

  it("restoreObligationOccurrence deletes the marker", async () => {
    vi.mocked(recurringRepo.findById).mockResolvedValue(rec());
    vi.mocked(movementsRepo.findByRuleOnDate).mockResolvedValue(
      movementRow({ id: "occ", status: MovementStatus.SKIPPED }),
    );
    vi.mocked(movements.deleteMovement).mockResolvedValue({
      count: 1,
    } as never);

    await service.restoreObligationOccurrence("u1", {
      ruleId: "r1",
      occurrenceDate: new Date("2026-07-25"),
    });

    expect(movements.deleteMovement).toHaveBeenCalledWith("occ", "u1");
  });

  it("rejects overriding an already-paid occurrence", async () => {
    vi.mocked(recurringRepo.findById).mockResolvedValue(rec());
    vi.mocked(movementsRepo.findByRuleOnDate).mockResolvedValue(
      movementRow({ id: "occ", status: MovementStatus.ACTUAL }),
    );

    await expect(
      service.skipObligationOccurrence("u1", {
        ruleId: "r1",
        occurrenceDate: new Date("2026-07-25"),
      }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(movements.createMovement).not.toHaveBeenCalled();
    expect(movements.updateMovement).not.toHaveBeenCalled();
  });
});

describe("listExpenses", () => {
  it("combines paid + due + projected EXPENSE, excluding income and materialized rules", async () => {
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(
      rule({ id: "primary", type: MovementType.INCOME, dayOfMonth: 25 }),
    );
    vi.mocked(recurring.listActiveRules).mockResolvedValue([
      rule({ id: "primary", type: MovementType.INCOME, dayOfMonth: 25 }),
      rule({ id: "spp", type: MovementType.EXPENSE, dayOfMonth: 10 }),
    ]);
    vi.mocked(movementsRepo.listByUserInWindow).mockResolvedValue([
      movementRow({
        id: "cash",
        status: MovementStatus.ACTUAL,
        type: MovementType.EXPENSE,
        effectiveDate: new Date("2026-06-26"),
      }),
      movementRow({
        id: "obl",
        status: MovementStatus.PLANNED,
        type: MovementType.EXPENSE,
        cardId: "c1",
        paymentMethod: PaymentMethod.CREDIT_CARD,
        effectiveDate: new Date("2026-07-03"),
      }),
      // an income movement that must NOT appear among expenses
      movementRow({
        id: "inc",
        type: MovementType.INCOME,
        status: MovementStatus.ACTUAL,
      }),
    ]);
    vi.mocked(cardsRepo.listActive).mockResolvedValue([card({ id: "c1" })]);

    const view = await service.listExpenses("u1", 0, new Date("2026-06-26"));

    expect(view.anchorDay).toBe(25);
    expect(view.items.some((i) => i.movementId === "inc")).toBe(false);
    expect(view.items.some((i) => i.kind === "paid")).toBe(true);
    expect(view.items.some((i) => i.kind === "due")).toBe(true);
    const projected = view.items.filter((i) => i.kind === "projected");
    expect(projected).toHaveLength(1);
    expect(projected[0]?.ruleId).toBe("spp");

    // Summary rolls the same items up: paid 100k spent; due 100k + projected
    // 1.5M upcoming; 3 contributing rows.
    expect(view.summary).toEqual({
      spent: 100_000,
      upcoming: 1_600_000,
      total: 1_700_000,
      count: 3,
    });
  });

  it("shows a SKIPPED occurrence as 'skipped' and suppresses its projection", async () => {
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(
      rule({ id: "primary", type: MovementType.INCOME, dayOfMonth: 25 }),
    );
    vi.mocked(recurring.listActiveRules).mockResolvedValue([
      rule({ id: "primary", type: MovementType.INCOME, dayOfMonth: 25 }),
      rule({ id: "spp", type: MovementType.EXPENSE, dayOfMonth: 10 }),
    ]);
    // The "spp" occurrence this cycle is skipped (materialized SKIPPED).
    vi.mocked(movementsRepo.listByUserInWindow).mockResolvedValue([
      movementRow({
        id: "skip",
        status: MovementStatus.SKIPPED,
        type: MovementType.EXPENSE,
        recurringRuleId: "spp",
        effectiveDate: new Date("2026-07-10"),
      }),
    ]);
    vi.mocked(cardsRepo.listActive).mockResolvedValue([]);

    const view = await service.listExpenses("u1", 0, new Date("2026-06-26"));

    // The skipped row shows once, and "spp" no longer projects a second row.
    expect(view.items.filter((i) => i.kind === "skipped")).toHaveLength(1);
    expect(view.items.some((i) => i.kind === "projected")).toBe(false);
    // A skipped occurrence is the only item → it contributes nothing.
    expect(view.summary).toEqual({
      spent: 0,
      upcoming: 0,
      total: 0,
      count: 0,
    });
  });
});

describe("summarizeExpenseItems", () => {
  const item = (over: Partial<ExpenseItem>): ExpenseItem => ({
    kind: "due",
    movementId: "m",
    ruleId: null,
    amount: 0,
    walletId: "w",
    cardId: null,
    categoryId: null,
    paymentMethod: null,
    effectiveDate: new Date("2026-06-26"),
    note: null,
    ...over,
  });

  it("splits paid (spent) from due/projected (upcoming) and excludes skipped", () => {
    const summary = service.summarizeExpenseItems([
      item({ kind: "paid", amount: 250_000 }),
      item({ kind: "due", amount: 100_000 }),
      item({ kind: "projected", amount: 1_500_000, ruleId: "spp" }),
      item({ kind: "skipped", amount: 999_999, ruleId: "spp" }),
    ]);
    expect(summary).toEqual({
      spent: 250_000,
      upcoming: 1_600_000,
      total: 1_850_000,
      count: 3,
    });
  });

  it("is all-zero for an empty cycle", () => {
    expect(service.summarizeExpenseItems([])).toEqual({
      spent: 0,
      upcoming: 0,
      total: 0,
      count: 0,
    });
  });
});
