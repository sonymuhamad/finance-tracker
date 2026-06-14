import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Movement, RecurringRule } from "@/generated/prisma/client";
import { MovementStatus, MovementType } from "@/generated/prisma/enums";

vi.mock("@/features/wallets/service");
vi.mock("@/features/recurring/repository");
vi.mock("@/features/recurring/service");
vi.mock("@/features/movements/repository");

import * as movementsRepo from "@/features/movements/repository";
import * as recurringRepo from "@/features/recurring/repository";
import * as recurring from "@/features/recurring/service";
import * as wallets from "@/features/wallets/service";
import * as service from "../service";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const rule = (over: Record<string, unknown>): RecurringRule =>
  ({
    id: "spp",
    userId: "u1",
    type: MovementType.EXPENSE,
    amount: 800_000,
    dayOfMonth: 10,
    walletId: "bca",
    cardId: null,
    categoryId: "tagihan",
    isPrimaryIncome: false,
    note: null,
    startsOn: d("2026-01-01"),
    endedAt: null,
    createdAt: d("2026-01-01"),
    updatedAt: d("2026-01-01"),
    ...over,
  }) as unknown as RecurringRule;

const movementRow = (over: Record<string, unknown>): Movement =>
  ({
    id: "m",
    userId: "u1",
    type: MovementType.EXPENSE,
    status: MovementStatus.PLANNED,
    amount: 2_000_000,
    walletId: "bca",
    cardId: null,
    categoryId: null,
    paymentMethod: null,
    occurredAt: d("2026-07-03"),
    effectiveDate: d("2026-07-03"),
    note: null,
    recurringRuleId: null,
    confirmedAt: null,
    createdAt: d("2026-07-03"),
    updatedAt: d("2026-07-03"),
    ...over,
  }) as unknown as Movement;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCycleForecast", () => {
  it("composes pooled balance + planned obligations + projected occurrences", async () => {
    vi.mocked(wallets.listWallets).mockResolvedValue({
      wallets: [
        {
          wallet: { id: "bca" } as never,
          balance: 1_000_000,
        },
      ],
      pooled: 1_000_000,
      archived: [],
    } as never);
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(
      rule({ id: "gaji", type: MovementType.INCOME, dayOfMonth: 25 }),
    );
    vi.mocked(recurring.listActiveRules).mockResolvedValue([
      rule({ id: "spp", type: MovementType.EXPENSE, dayOfMonth: 10 }),
    ]);
    vi.mocked(movementsRepo.listByUserInWindow).mockResolvedValue([
      movementRow({ id: "cc", effectiveDate: d("2026-07-03"), note: "CC BCA" }),
    ]);

    const { forecast, strip, hasPrimaryIncome } =
      await service.getCycleForecast("u1", 0, d("2026-07-06"));

    expect(hasPrimaryIncome).toBe(true);
    expect(forecast.x).toBe(1_000_000);
    // Y = planned CC obligation (2,000,000) + projected SPP (800,000)
    expect(forecast.y).toBe(2_800_000);
    expect(forecast.z).toBe(-1_800_000);
    expect(forecast.obligations).toHaveLength(2);
    // Sorted by date: the planned CC (3 Jul) carries its note; the projected
    // SPP (10 Jul) has none — projections don't surface the rule's note.
    expect(forecast.obligations[0].note).toBe("CC BCA");
    expect(forecast.obligations[1].note).toBeNull();
    // strip = current + 12 forward (no past cycles)
    expect(strip).toHaveLength(13);
  });

  it("excludes a rule already materialized in the cycle (no double-count)", async () => {
    vi.mocked(wallets.listWallets).mockResolvedValue({
      wallets: [],
      pooled: 0,
      archived: [],
    } as never);
    vi.mocked(recurringRepo.findPrimaryIncome).mockResolvedValue(
      rule({ id: "gaji", type: MovementType.INCOME, dayOfMonth: 25 }),
    );
    vi.mocked(recurring.listActiveRules).mockResolvedValue([
      rule({ id: "spp", type: MovementType.EXPENSE, dayOfMonth: 10 }),
    ]);
    // SPP already materialized (ACTUAL, links to the rule) in this cycle
    vi.mocked(movementsRepo.listByUserInWindow).mockResolvedValue([
      movementRow({
        id: "spp-paid",
        status: MovementStatus.ACTUAL,
        recurringRuleId: "spp",
        amount: 800_000,
        effectiveDate: d("2026-07-10"),
      }),
    ]);

    const { forecast } = await service.getCycleForecast(
      "u1",
      0,
      d("2026-07-06"),
    );

    // The ACTUAL is already in pooled; the projection is suppressed → no pending Y.
    expect(forecast.y).toBe(0);
    expect(forecast.obligations).toHaveLength(0);
  });
});
