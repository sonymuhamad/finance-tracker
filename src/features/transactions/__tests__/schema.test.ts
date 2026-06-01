import { describe, expect, it } from "vitest";
import { createTransactionSchema } from "../schema";

const base = {
  type: "EXPENSE",
  amount: "15000",
  categoryId: "cat_1",
  occurredAt: "2026-06-01",
};

describe("createTransactionSchema", () => {
  it("coerces amount and date", () => {
    const r = createTransactionSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.amount).toBe(15000);
      expect(r.data.occurredAt).toBeInstanceOf(Date);
    }
  });

  it("rejects a non-positive amount", () => {
    expect(
      createTransactionSchema.safeParse({ ...base, amount: "0" }).success,
    ).toBe(false);
    expect(
      createTransactionSchema.safeParse({ ...base, amount: "-5" }).success,
    ).toBe(false);
  });

  it("requires a category", () => {
    expect(
      createTransactionSchema.safeParse({ ...base, categoryId: "" }).success,
    ).toBe(false);
  });

  it("rejects a note longer than 140 chars", () => {
    expect(
      createTransactionSchema.safeParse({ ...base, note: "x".repeat(141) })
        .success,
    ).toBe(false);
  });

  it("rejects an invalid type", () => {
    expect(
      createTransactionSchema.safeParse({ ...base, type: "FOO" }).success,
    ).toBe(false);
  });
});
