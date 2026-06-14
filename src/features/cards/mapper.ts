import type { Card } from "@/generated/prisma/client";
import type { CardKindValue } from "./schema";
import type { CardDTO } from "./types";

/** Map a persisted card to its serializable client DTO. */
export function toCardDTO(card: Card): CardDTO {
  return {
    id: card.id,
    name: card.name,
    kind: card.kind as CardKindValue,
    defaultDueDay: card.defaultDueDay,
    payingWalletId: card.payingWalletId,
  };
}
