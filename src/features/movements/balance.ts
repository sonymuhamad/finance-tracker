/**
 * Pure movement domain logic (RFC 0005). No I/O — the repository feeds these.
 *
 * Amounts are plain numbers in the major unit (see lib/money.ts). Movements are
 * always stored with a positive `amount` except ADJUSTMENT, which carries a
 * signed delta (a manual correction can raise or lower a balance).
 */

import {
  MovementStatus,
  MovementType,
  PaymentMethod,
} from "@/generated/prisma/enums";
import { roundMoney } from "@/lib/money";

export type BalanceMovement = {
  type: MovementType;
  status: MovementStatus;
  amount: number;
};

/**
 * A wallet's balance = starting balance + the net of its **actual** movements.
 * Planned movements (obligations, expected income) have not moved yet.
 */
export function deriveBalance(
  startingBalance: number,
  movements: BalanceMovement[],
): number {
  let balance = startingBalance;
  for (const m of movements) {
    if (m.status !== MovementStatus.ACTUAL) continue;
    if (m.type === MovementType.INCOME) balance += m.amount;
    else if (m.type === MovementType.EXPENSE) balance -= m.amount;
    else if (m.type === MovementType.ADJUSTMENT) balance += m.amount; // signed
  }
  return roundMoney(balance);
}

export type Timing = { status: MovementStatus; effectiveDate: Date };

/**
 * The payment method decides *when* an expense hits a wallet:
 * - cash → actual, on the transaction date;
 * - credit card / paylater → a planned obligation, on its due date.
 */
export function resolveTiming(
  method: PaymentMethod,
  occurredAt: Date,
  dueDate: Date | null,
): Timing {
  if (method === PaymentMethod.CASH) {
    return { status: MovementStatus.ACTUAL, effectiveDate: occurredAt };
  }
  if (!dueDate) {
    throw new Error("A credit-card / paylater obligation requires a due date.");
  }
  return { status: MovementStatus.PLANNED, effectiveDate: dueDate };
}

/** The signed delta to record so a wallet's derived balance becomes `target`. */
export function adjustmentDelta(
  currentBalance: number,
  targetBalance: number,
): number {
  return roundMoney(targetBalance - currentBalance);
}
