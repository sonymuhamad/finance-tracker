import * as repo from "./repository";
import type { MovementInput } from "./types";

/**
 * The movement primitive (RFC 0005). Feature services compose these with
 * their own wallet/card/cycle lookups; they never import Prisma directly.
 *
 * Pure domain helpers (deriveBalance, resolveTiming, adjustmentDelta) live in
 * ./balance and are re-exported here for convenience.
 */
export {
  adjustmentDelta,
  type BalanceMovement,
  deriveBalance,
  resolveTiming,
  type Timing,
} from "./balance";

/** Persist a fully-resolved movement. */
export function createMovement(input: MovementInput) {
  return repo.create(input);
}

/**
 * Confirm a planned movement (income received / obligation paid): flip it to
 * actual, stamping when. The paying wallet, amount and effective date may be
 * overridden at confirm time.
 */
export function confirmMovement(
  id: string,
  userId: string,
  overrides: { walletId?: string; amount?: number; effectiveDate?: Date } = {},
) {
  return repo.confirm(id, userId, { confirmedAt: new Date(), ...overrides });
}

export function deleteMovement(id: string, userId: string) {
  return repo.remove(id, userId);
}
