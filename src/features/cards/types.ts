import type { CardKindValue } from "./schema";

/** Plain, serializable card for client components. */
export type CardDTO = {
  id: string;
  name: string;
  kind: CardKindValue;
  defaultDueDay: number;
  payingWalletId: string;
};
