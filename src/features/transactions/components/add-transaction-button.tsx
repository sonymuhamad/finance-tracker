"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CategoryDTO } from "@/features/categories/types";
import { TransactionFormDialog } from "./transaction-form-dialog";

export function AddTransactionButton({
  categories,
  label = "Catat",
}: {
  categories: CategoryDTO[];
  label?: string;
}) {
  return (
    <TransactionFormDialog
      categories={categories}
      trigger={
        <Button className="gap-1.5">
          <Plus className="size-4" />
          {label}
        </Button>
      }
    />
  );
}
