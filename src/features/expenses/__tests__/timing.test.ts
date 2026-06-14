import { describe, expect, it } from "vitest";
import { nextDueDate } from "../timing";

// Dates are UTC-midnight calendar dates (the cycle convention).
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("nextDueDate", () => {
  it("uses this month when the due day hasn't passed", () => {
    expect(nextDueDate(20, d("2026-06-05"))).toEqual(d("2026-06-20"));
  });

  it("rolls to next month when the due day already passed", () => {
    expect(nextDueDate(3, d("2026-06-05"))).toEqual(d("2026-07-03"));
  });

  it("includes the due day itself (on-or-after)", () => {
    expect(nextDueDate(5, d("2026-06-05"))).toEqual(d("2026-06-05"));
  });

  it("clamps to the month length for short months", () => {
    expect(nextDueDate(31, d("2026-02-10"))).toEqual(d("2026-02-28"));
  });

  it("rolls across a year boundary", () => {
    expect(nextDueDate(1, d("2026-12-15"))).toEqual(d("2027-01-01"));
  });
});
