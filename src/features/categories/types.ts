import type { CategoryType } from "./schema";

/** Plain, serializable category for client components. */
export type CategoryDTO = {
  id: string;
  name: string;
  type: CategoryType;
  color: string | null;
  icon: string | null;
};
