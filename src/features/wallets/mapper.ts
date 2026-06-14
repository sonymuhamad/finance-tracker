import type { Wallet } from "@/generated/prisma/client";
import type { WalletTypeValue } from "./schema";
import type { ArchivedWalletDTO, WalletDTO } from "./types";

/** Map a persisted wallet + its derived balance to the client DTO. */
export function toWalletDTO(wallet: Wallet, balance: number): WalletDTO {
  return {
    id: wallet.id,
    name: wallet.name,
    type: wallet.type as WalletTypeValue,
    isPrimary: wallet.isPrimary,
    emoji: wallet.emoji,
    color: wallet.color,
    startingBalance: Number(wallet.startingBalance),
    balance,
  };
}

export function toArchivedWalletDTO(wallet: Wallet): ArchivedWalletDTO {
  return {
    id: wallet.id,
    name: wallet.name,
    type: wallet.type as WalletTypeValue,
    emoji: wallet.emoji,
    color: wallet.color,
  };
}
