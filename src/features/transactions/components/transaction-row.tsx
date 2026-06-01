"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { CategoryDTO } from "@/features/categories/types";
import { TransactionType } from "@/generated/prisma/enums";
import { formatCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";
import { deleteTransactionAction } from "../actions";
import type { TransactionDTO } from "../types";
import { TransactionFormDialog } from "./transaction-form-dialog";

export function TransactionRow({
  transaction,
  categories,
}: {
  transaction: TransactionDTO;
  categories: CategoryDTO[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isIncome = transaction.type === TransactionType.INCOME;

  function onDelete() {
    if (!confirm("Hapus transaksi ini?")) return;
    startTransition(async () => {
      const result = await deleteTransactionAction(transaction.id);
      if (result.ok) {
        toast.success("Transaksi dihapus");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <li className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-lg"
        style={{
          backgroundColor: `${transaction.category.color ?? "#a8a29e"}22`,
        }}
      >
        {transaction.category.icon || "🏷️"}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{transaction.category.name}</p>
        {transaction.note ? (
          <p className="truncate text-muted-foreground text-sm">
            {transaction.note}
          </p>
        ) : null}
      </div>

      <span
        className={cn(
          "shrink-0 font-semibold tabular-nums",
          isIncome ? "text-emerald-600" : "text-foreground",
        )}
      >
        {isIncome ? "+" : "−"}
        {formatCurrency(transaction.amount)}
      </span>

      <div className="flex shrink-0 items-center">
        <TransactionFormDialog
          categories={categories}
          editing={transaction}
          trigger={
            <button
              type="button"
              className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
              aria-label="Ubah"
            >
              <Pencil className="size-4" />
            </button>
          }
        />
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Hapus"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}
