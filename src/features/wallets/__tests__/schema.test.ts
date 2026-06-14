import { describe, expect, it } from "vitest";
import { adjustBalanceSchema, createWalletSchema } from "../schema";

describe("adjustBalanceSchema", () => {
  it("accepts a non-negative target balance", () => {
    expect(
      adjustBalanceSchema.safeParse({ targetBalance: 700_000 }).success,
    ).toBe(true);
  });

  it("rejects a missing target (a cleared field must not silently zero a wallet)", () => {
    expect(
      adjustBalanceSchema.safeParse({ targetBalance: undefined }).success,
    ).toBe(false);
  });

  it("rejects a negative target", () => {
    expect(adjustBalanceSchema.safeParse({ targetBalance: -1 }).success).toBe(
      false,
    );
  });
});

describe("createWalletSchema", () => {
  it("defaults the starting balance to 0", () => {
    const result = createWalletSchema.safeParse({ name: "Cash", type: "CASH" });
    expect(result.success && result.data.startingBalance).toBe(0);
  });

  it("rejects an unknown wallet type", () => {
    expect(
      createWalletSchema.safeParse({ name: "X", type: "CRYPTO" }).success,
    ).toBe(false);
  });
});
