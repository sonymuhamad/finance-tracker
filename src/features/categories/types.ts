import type { TransactionType } from "@/generated/prisma/enums";

/** Plain, serializable category for client components. */
export type CategoryDTO = {
  id: string;
  name: string;
  type: TransactionType;
  color: string | null;
  icon: string | null;
};
