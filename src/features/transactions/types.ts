import type { TransactionType } from "@/generated/prisma/enums";

/** Plain, serializable transaction for client components. */
export type TransactionDTO = {
  id: string;
  type: TransactionType;
  amount: number;
  occurredAt: string; // ISO date (yyyy-mm-dd granularity is enough for display)
  note: string | null;
  category: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  };
};
