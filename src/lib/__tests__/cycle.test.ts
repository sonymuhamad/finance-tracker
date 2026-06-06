import { describe, expect, it } from "vitest";
import {
  cycleOf,
  getCurrentCycle,
  getCycleByOffset,
  getCycleRange,
  occurrenceDateInCycle,
} from "../cycle";

/** Compare a cycle boundary by its calendar date (boundaries are UTC midnight). */
const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("getCurrentCycle", () => {
  it("returns the cycle containing today for a mid-month anchor", () => {
    const c = getCurrentCycle(25, new Date("2026-06-06"));
    expect(iso(c.start)).toBe("2026-05-25");
    expect(iso(c.end)).toBe("2026-06-24");
    expect(c.label).toBe("25 Mei – 24 Jun");
    expect(c.offset).toBe(0);
    expect(c.isCurrent).toBe(true);
  });

  it("starts a new cycle on the anchor day itself", () => {
    const c = getCurrentCycle(25, new Date("2026-06-25"));
    expect(iso(c.start)).toBe("2026-06-25");
    expect(iso(c.end)).toBe("2026-07-24");
  });

  it("treats the day before the anchor as the previous cycle's last day", () => {
    const c = getCurrentCycle(25, new Date("2026-06-24"));
    expect(iso(c.start)).toBe("2026-05-25");
    expect(iso(c.end)).toBe("2026-06-24");
  });

  it("handles year rollover", () => {
    const c = getCurrentCycle(25, new Date("2026-01-10"));
    expect(iso(c.start)).toBe("2025-12-25");
    expect(iso(c.end)).toBe("2026-01-24");
  });

  it("clamps an anchor past the month length (Feb, anchor day 31)", () => {
    const c = getCurrentCycle(31, new Date("2026-02-15"));
    expect(iso(c.start)).toBe("2026-01-31");
    expect(iso(c.end)).toBe("2026-02-27"); // day before clamped Feb 28
  });

  it("uses the clamped last day as the anchor (Feb 28 cycle)", () => {
    const c = getCurrentCycle(31, new Date("2026-03-01"));
    expect(iso(c.start)).toBe("2026-02-28");
    expect(iso(c.end)).toBe("2026-03-30"); // day before Mar 31
  });

  it("falls back to calendar months when the anchor is 1", () => {
    const c = getCurrentCycle(1, new Date("2026-06-15"));
    expect(iso(c.start)).toBe("2026-06-01");
    expect(iso(c.end)).toBe("2026-06-30");
    expect(c.label).toBe("1 Jun – 30 Jun");
  });

  it("uses the Asia/Jakarta calendar date for late-evening UTC times", () => {
    // 2026-06-24T20:00:00Z is 2026-06-25 03:00 in Jakarta → the next cycle.
    const c = getCurrentCycle(25, new Date("2026-06-24T20:00:00Z"));
    expect(iso(c.start)).toBe("2026-06-25");
  });
});

describe("getCycleByOffset", () => {
  const today = new Date("2026-06-06"); // current = May 25 – Jun 24

  it("offset +1 is the next cycle", () => {
    const c = getCycleByOffset(25, today, 1);
    expect(iso(c.start)).toBe("2026-06-25");
    expect(iso(c.end)).toBe("2026-07-24");
    expect(c.offset).toBe(1);
    expect(c.isCurrent).toBe(false);
  });

  it("offset -1 is the previous cycle", () => {
    const c = getCycleByOffset(25, today, -1);
    expect(iso(c.start)).toBe("2026-04-25");
    expect(iso(c.end)).toBe("2026-05-24");
  });
});

describe("cycleOf", () => {
  const today = new Date("2026-06-06"); // current = May 25 – Jun 24

  it("returns 0 for a date in the current cycle (inclusive of the start)", () => {
    expect(cycleOf(25, today, new Date("2026-06-10"))).toBe(0);
    expect(cycleOf(25, today, new Date("2026-05-25"))).toBe(0);
  });

  it("returns +1 for a date in the next cycle", () => {
    expect(cycleOf(25, today, new Date("2026-07-10"))).toBe(1);
  });

  it("returns -1 for a date in the previous cycle", () => {
    expect(cycleOf(25, today, new Date("2026-05-01"))).toBe(-1);
  });
});

describe("getCycleRange", () => {
  it("returns cycles from -back to +forward inclusive, in order", () => {
    const range = getCycleRange(25, new Date("2026-06-06"), {
      back: 1,
      forward: 2,
    });
    expect(range.map((c) => c.offset)).toEqual([-1, 0, 1, 2]);
    expect(iso(range[0].start)).toBe("2026-04-25");
    expect(iso(range[3].end)).toBe("2026-08-24");
  });
});

describe("occurrenceDateInCycle", () => {
  const cycle = getCurrentCycle(25, new Date("2026-06-06")); // May 25 – Jun 24

  it("places a day in the cycle's first calendar month", () => {
    expect(iso(occurrenceDateInCycle(28, cycle) as Date)).toBe("2026-05-28");
  });

  it("places a day in the cycle's second calendar month", () => {
    expect(iso(occurrenceDateInCycle(1, cycle) as Date)).toBe("2026-06-01");
  });

  it("matches the anchor day on the cycle's first day", () => {
    expect(iso(occurrenceDateInCycle(25, cycle) as Date)).toBe("2026-05-25");
  });

  it("matches the last day of the cycle", () => {
    expect(iso(occurrenceDateInCycle(24, cycle) as Date)).toBe("2026-06-24");
  });

  it("clamps a day past the month length to that month's last day", () => {
    // Day 31 in May → May 31 (May has 31 days), still inside the window.
    expect(iso(occurrenceDateInCycle(31, cycle) as Date)).toBe("2026-05-31");
  });

  it("works for calendar-month cycles (anchor 1), clamping day 31", () => {
    const june = getCurrentCycle(1, new Date("2026-06-15")); // Jun 1 – Jun 30
    expect(iso(occurrenceDateInCycle(15, june) as Date)).toBe("2026-06-15");
    expect(iso(occurrenceDateInCycle(31, june) as Date)).toBe("2026-06-30");
  });
});
