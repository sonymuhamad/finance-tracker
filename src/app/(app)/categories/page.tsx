import { requireUser } from "@/features/auth/service";
import { CategoryManager } from "@/features/categories/components/category-manager";
import { toCategoryDTO } from "@/features/categories/mapper";
import { listCategories } from "@/features/categories/service";

export default async function CategoriesPage() {
  const user = await requireUser();
  const categories = await listCategories(user.id);

  return (
    <div className="py-6">
      <CategoryManager initial={categories.map(toCategoryDTO)} />
    </div>
  );
}
