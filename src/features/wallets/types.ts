import type { WalletTypeValue } from "./schema";

/** Plain, serializable active wallet for client components. */
export type WalletDTO = {
  id: string;
  name: string;
  type: WalletTypeValue;
  isPrimary: boolean;
  emoji: string | null;
  color: string | null;
  startingBalance: number;
  /** Derived: startingBalance + net of the wallet's ACTUAL movements. */
  balance: number;
};

/** Archived wallets are kept for history but excluded from the pooled total. */
export type ArchivedWalletDTO = {
  id: string;
  name: string;
  type: WalletTypeValue;
  emoji: string | null;
  color: string | null;
};
