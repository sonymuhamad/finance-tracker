import { WalletType } from "@/generated/prisma/enums";

/**
 * Seeded once for a new user so the app is never empty (PRD 005): a Cash wallet
 * at zero, marked primary. Onboarding then nudges adding a bank / e-wallet.
 */
export const DEFAULT_WALLET = {
  name: "Cash",
  type: WalletType.CASH,
  startingBalance: 0,
  emoji: "💵",
} as const;
