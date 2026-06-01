import type { TransactionType } from "@/generated/prisma/enums";
import type { CategoryDTO } from "./types";

type CategoryRow = {
  id: string;
  name: string;
  type: TransactionType;
  color: string | null;
  icon: string | null;
};

/** Map a persisted category to its serializable client DTO. */
export function toCategoryDTO(category: CategoryRow): CategoryDTO {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    color: category.color,
    icon: category.icon,
  };
}
