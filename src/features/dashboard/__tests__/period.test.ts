import { describe, expect, it } from "vitest";
import {
  formatMonthParam,
  monthRange,
  parseMonthParam,
  shiftMonth,
} from "../period";

describe("monthRange", () => {
  it("returns UTC [start, end) for a month", () => {
    const { start, end } = monthRange(2026, 6);
    expect(start.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("rolls the year over for December", () => {
    const { start, end } = monthRange(2026, 12);
    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("shiftMonth", () => {
  it("advances across a year boundary", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });
  it("goes back across a year boundary", () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("parseMonthParam", () => {
  const now = new Date("2026-06-15T10:00:00.000Z");

  it("parses a valid YYYY-MM", () => {
    expect(parseMonthParam("2025-03", now)).toEqual({ year: 2025, month: 3 });
  });
  it("falls back to now for missing/invalid input", () => {
    expect(parseMonthParam(undefined, now)).toEqual({ year: 2026, month: 6 });
    expect(parseMonthParam("2026-13", now)).toEqual({ year: 2026, month: 6 });
    expect(parseMonthParam("garbage", now)).toEqual({ year: 2026, month: 6 });
  });
});

describe("formatMonthParam", () => {
  it("zero-pads the month", () => {
    expect(formatMonthParam(2026, 6)).toBe("2026-06");
  });
});
