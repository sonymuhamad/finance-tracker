import { describe, expect, it } from "vitest";
import {
  MovementStatus,
  MovementType,
  PaymentMethod,
} from "@/generated/prisma/enums";
import { adjustmentDelta, deriveBalance, resolveTiming } from "../balance";

const actual = (type: MovementType, amount: number) => ({
  type,
  status: MovementStatus.ACTUAL,
  amount,
});

describe("deriveBalance", () => {
  it("adds actual income and subtracts actual expense", () => {
    const balance = deriveBalance(100_000, [
      actual(MovementType.INCOME, 50_000),
      actual(MovementType.EXPENSE, 20_000),
    ]);
    expect(balance).toBe(130_000);
  });

  it("ignores planned movements (they have not moved yet)", () => {
    const balance = deriveBalance(100_000, [
      {
        type: MovementType.EXPENSE,
        status: MovementStatus.PLANNED,
        amount: 80_000,
      },
      actual(MovementType.INCOME, 5_000),
    ]);
    expect(balance).toBe(105_000);
  });

  it("treats an adjustment as a signed delta", () => {
    expect(
      deriveBalance(100_000, [actual(MovementType.ADJUSTMENT, 10_000)]),
    ).toBe(110_000);
    expect(
      deriveBalance(100_000, [actual(MovementType.ADJUSTMENT, -15_000)]),
    ).toBe(85_000);
  });

  it("starts from the starting balance with no movements", () => {
    expect(deriveBalance(250_000, [])).toBe(250_000);
  });
});

describe("resolveTiming", () => {
  const occurredAt = new Date("2026-06-06");
  const dueDate = new Date("2026-07-02");

  it("cash moves now (actual, effective on the transaction date)", () => {
    const t = resolveTiming(PaymentMethod.CASH, occurredAt, null);
    expect(t.status).toBe(MovementStatus.ACTUAL);
    expect(t.effectiveDate).toEqual(occurredAt);
  });

  it("credit card is a planned obligation effective on the due date", () => {
    const t = resolveTiming(PaymentMethod.CREDIT_CARD, occurredAt, dueDate);
    expect(t.status).toBe(MovementStatus.PLANNED);
    expect(t.effectiveDate).toEqual(dueDate);
  });

  it("paylater is a planned obligation effective on the due date", () => {
    const t = resolveTiming(PaymentMethod.PAYLATER, occurredAt, dueDate);
    expect(t.status).toBe(MovementStatus.PLANNED);
    expect(t.effectiveDate).toEqual(dueDate);
  });

  it("throws if a credit/paylater obligation has no due date", () => {
    expect(() =>
      resolveTiming(PaymentMethod.CREDIT_CARD, occurredAt, null),
    ).toThrow();
  });
});

describe("adjustmentDelta", () => {
  it("returns a positive delta to raise the balance to the target", () => {
    expect(adjustmentDelta(100_000, 120_000)).toBe(20_000);
  });

  it("returns a negative delta to lower the balance to the target", () => {
    expect(adjustmentDelta(100_000, 80_000)).toBe(-20_000);
  });

  it("returns zero when already at target", () => {
    expect(adjustmentDelta(100_000, 100_000)).toBe(0);
  });
});
