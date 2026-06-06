import type { Category } from "@/generated/prisma/client";
import type { CategoryType } from "./schema";
import type { CategoryDTO } from "./types";

type CategoryRow = Pick<Category, "id" | "name" | "type" | "color" | "icon">;

/** Map a persisted category to its serializable client DTO. */
export function toCategoryDTO(category: CategoryRow): CategoryDTO {
  return {
    id: category.id,
    name: category.name,
    // The DB column is the wider MovementType; categories are kept to
    // INCOME | EXPENSE by the Zod schema at the action boundary.
    type: category.type as CategoryType,
    color: category.color,
    icon: category.icon,
  };
}
