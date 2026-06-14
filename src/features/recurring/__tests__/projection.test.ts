import { describe, expect, it } from "vitest";
import { MovementType } from "@/generated/prisma/enums";
import { getCurrentCycle } from "@/lib/cycle";
import { type ProjectionRule, projectOccurrences } from "../projection";

const cycle = getCurrentCycle(25, new Date("2026-06-06")); // May 25 – Jun 24, offset 0
const iso = (d: Date) => d.toISOString().slice(0, 10);

const rule = (
  over: Partial<ProjectionRule> & Pick<ProjectionRule, "id" | "dayOfMonth">,
): ProjectionRule => ({
  type: MovementType.EXPENSE,
  amount: 1_000_000,
  walletId: "w1",
  cardId: null,
  categoryId: null,
  note: null,
  startsOn: new Date("2026-01-01"),
  endedAt: null,
  ...over,
});

describe("projectOccurrences", () => {
  it("projects a virtual occurrence on the rule's day within the cycle", () => {
    const occ = projectOccurrences(
      [rule({ id: "r1", dayOfMonth: 5 })],
      cycle,
      new Set(),
    );
    expect(occ).toHaveLength(1);
    expect(occ[0].ruleId).toBe("r1");
    expect(iso(occ[0].effectiveDate)).toBe("2026-06-05");
    expect(occ[0].cycleOffset).toBe(0);
  });

  it("carries the rule's note onto the occurrence (to tell same-tag items apart)", () => {
    const occ = projectOccurrences(
      [rule({ id: "r1", dayOfMonth: 5, note: "Buat Bunda" })],
      cycle,
      new Set(),
    );
    expect(occ[0].note).toBe("Buat Bunda");
  });

  it("excludes a rule already materialized in this cycle (no double-count)", () => {
    const occ = projectOccurrences(
      [rule({ id: "r1", dayOfMonth: 5 })],
      cycle,
      new Set(["r1"]),
    );
    expect(occ).toHaveLength(0);
  });

  it("excludes a rule that has not started yet", () => {
    // dayOfMonth 28 → would fire May 28, but the rule only starts Jun 1.
    const occ = projectOccurrences(
      [rule({ id: "r1", dayOfMonth: 28, startsOn: new Date("2026-06-01") })],
      cycle,
      new Set(),
    );
    expect(occ).toHaveLength(0);
  });

  it("excludes a rule that ended on or before its occurrence", () => {
    // dayOfMonth 10 → fires Jun 10, but the rule ended Jun 1.
    const occ = projectOccurrences(
      [rule({ id: "r1", dayOfMonth: 10, endedAt: new Date("2026-06-01") })],
      cycle,
      new Set(),
    );
    expect(occ).toHaveLength(0);
  });

  it("does not drop the first occurrence when startsOn carries a time-of-day", () => {
    // startsOn stored as a non-midnight instant on its start date (Jun 1).
    // The occurrence (Jun 1, UTC midnight) must still count.
    const occ = projectOccurrences(
      [
        rule({
          id: "r1",
          dayOfMonth: 1,
          startsOn: new Date("2026-06-01T09:00:00Z"),
        }),
      ],
      cycle,
      new Set(),
    );
    expect(occ).toHaveLength(1);
    expect(iso(occ[0].effectiveDate)).toBe("2026-06-01");
  });

  it("keeps an occurrence whose date is the rule's endedAt-day but a later time", () => {
    // Rule ends Jun 10 (with a time); the Jun 5 occurrence is before that day.
    const occ = projectOccurrences(
      [
        rule({
          id: "r1",
          dayOfMonth: 5,
          endedAt: new Date("2026-06-10T09:00:00Z"),
        }),
      ],
      cycle,
      new Set(),
    );
    expect(occ).toHaveLength(1);
  });

  it("carries each rule's fields and projects multiple rules", () => {
    const occ = projectOccurrences(
      [
        rule({
          id: "salary",
          dayOfMonth: 1,
          type: MovementType.INCOME,
          amount: 14_000_000,
          walletId: "bca",
        }),
        rule({
          id: "cicilan",
          dayOfMonth: 5,
          amount: 2_000_000,
          cardId: "kartu1",
          categoryId: "cat1",
        }),
      ],
      cycle,
      new Set(),
    );
    expect(occ).toHaveLength(2);

    const salary = occ.find((o) => o.ruleId === "salary");
    expect(salary?.type).toBe(MovementType.INCOME);
    expect(salary?.amount).toBe(14_000_000);
    expect(salary?.walletId).toBe("bca");
    expect(iso(salary?.effectiveDate as Date)).toBe("2026-06-01");

    const cicilan = occ.find((o) => o.ruleId === "cicilan");
    expect(cicilan?.cardId).toBe("kartu1");
    expect(cicilan?.categoryId).toBe("cat1");
    expect(iso(cicilan?.effectiveDate as Date)).toBe("2026-06-05");
  });
});
