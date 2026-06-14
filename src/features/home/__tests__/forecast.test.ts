import { describe, expect, it } from "vitest";
import type { Cycle } from "@/lib/cycle";
import { computeForecast, type ForecastEvent } from "../forecast";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// Anchor 25: current cycle 25 Jun – 24 Jul; next cycle 25 Jul – 24 Aug.
const current: Cycle = {
  offset: 0,
  start: d("2026-06-25"),
  end: d("2026-07-24"),
  label: "25 Jun – 24 Jul",
  isCurrent: true,
};
const next: Cycle = {
  offset: 1,
  start: d("2026-07-25"),
  end: d("2026-08-24"),
  label: "25 Jul – 24 Agu",
  isCurrent: false,
};

const event = (
  kind: "income" | "expense",
  amount: number,
  date: string,
  over: Partial<ForecastEvent> = {},
): ForecastEvent => ({
  kind,
  amount,
  effectiveDate: d(date),
  movementId: null,
  ruleId: null,
  cardId: null,
  categoryId: null,
  walletId: "bca",
  note: null,
  ...over,
});

const TODAY = d("2026-07-06");

describe("computeForecast — current cycle", () => {
  it("Z = pooled − obligations; income is excluded from Z but reported", () => {
    const f = computeForecast({
      pooledNow: 1_000_000,
      perWallet: [{ walletId: "bca", balance: 1_000_000 }],
      cycle: current,
      isProjected: false,
      today: TODAY,
      events: [
        event("expense", 300_000, "2026-07-03", { movementId: "m1" }),
        event("income", 5_000_000, "2026-07-10", { movementId: "i1" }),
      ],
    });

    expect(f.x).toBe(1_000_000);
    expect(f.y).toBe(300_000);
    expect(f.z).toBe(700_000);
    expect(f.cycleIncome).toBe(5_000_000);
    expect(f.obligations).toHaveLength(1);
  });

  it("toConfirm holds only pending items already due (effectiveDate ≤ today)", () => {
    const f = computeForecast({
      pooledNow: 1_000_000,
      perWallet: [],
      cycle: current,
      isProjected: false,
      today: TODAY,
      events: [
        event("expense", 300_000, "2026-07-03", { movementId: "due" }), // ≤ today
        event("income", 5_000_000, "2026-07-10", { movementId: "later" }), // > today
      ],
    });

    expect(f.toConfirm.map((e) => e.movementId)).toEqual(["due"]);
  });

  it("toConfirm excludes items outside the cycle (even if before today)", () => {
    const f = computeForecast({
      pooledNow: 1_000_000,
      perWallet: [],
      cycle: current,
      isProjected: false,
      today: TODAY,
      events: [
        // before the cycle started (and before today) — belongs to a past cycle
        event("expense", 100_000, "2026-06-20", { movementId: "past" }),
        event("expense", 300_000, "2026-07-03", { movementId: "due" }),
      ],
    });

    expect(f.toConfirm.map((e) => e.movementId)).toEqual(["due"]);
  });

  it("per-day allowance = Z / days left, floored at 0", () => {
    const f = computeForecast({
      pooledNow: 100_000,
      perWallet: [],
      cycle: current,
      isProjected: false,
      today: TODAY,
      events: [event("expense", 500_000, "2026-07-03")],
    });

    expect(f.z).toBe(-400_000);
    expect(f.perDayAllowance).toBe(0); // never show a negative daily figure
  });
});

describe("computeForecast — future cycle (projected)", () => {
  it("Z = projected opening + cycle income − cycle obligations", () => {
    const f = computeForecast({
      pooledNow: 1_000_000,
      perWallet: [],
      cycle: next,
      isProjected: true,
      today: TODAY,
      events: [
        // intervening: between today and next cycle start → rolls the opening down
        event("expense", 200_000, "2026-07-10"),
        // in the target cycle
        event("income", 5_000_000, "2026-07-25"),
        event("expense", 1_000_000, "2026-08-03"),
      ],
    });

    expect(f.x).toBe(800_000); // projected opening = 1,000,000 − 200,000
    expect(f.y).toBe(1_000_000);
    expect(f.cycleIncome).toBe(5_000_000);
    expect(f.z).toBe(4_800_000); // 800,000 + 5,000,000 − 1,000,000
  });

  it("does not surface toConfirm for a future cycle", () => {
    const f = computeForecast({
      pooledNow: 1_000_000,
      perWallet: [],
      cycle: next,
      isProjected: true,
      today: TODAY,
      events: [event("expense", 1_000_000, "2026-08-03")],
    });

    expect(f.toConfirm).toEqual([]);
  });
});
