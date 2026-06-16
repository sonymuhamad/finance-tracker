import { describe, expect, it } from "vitest";
import { expenseSchema } from "../schema";

const cashExpense = (amount: number) => ({
  amount,
  date: "2026-06-15",
  method: "CASH",
  walletId: "w1",
});

describe("expenseSchema amount bounds", () => {
  it("accepts a normal amount", () => {
    expect(expenseSchema.safeParse(cashExpense(50_000)).success).toBe(true);
  });

  it("accepts the cap boundary (1 trillion)", () => {
    expect(
      expenseSchema.safeParse(cashExpense(1_000_000_000_000)).success,
    ).toBe(true);
  });

  // Guards the DB Decimal(18,2) overflow / >MAX_SAFE_INTEGER precision footgun.
  it("rejects an amount above the cap", () => {
    expect(
      expenseSchema.safeParse(cashExpense(2_000_000_000_000)).success,
    ).toBe(false);
  });

  it("rejects a non-positive amount", () => {
    expect(expenseSchema.safeParse(cashExpense(0)).success).toBe(false);
  });
});
