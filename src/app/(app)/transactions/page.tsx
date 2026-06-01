import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { requireUser } from "@/features/auth/service";
import { toCategoryDTO } from "@/features/categories/mapper";
import { listCategories } from "@/features/categories/service";
import { AddTransactionButton } from "@/features/transactions/components/add-transaction-button";
import { TransactionRow } from "@/features/transactions/components/transaction-row";
import { listRecent } from "@/features/transactions/service";
import type { TransactionDTO } from "@/features/transactions/types";

function groupByDay(transactions: TransactionDTO[]) {
  const groups = new Map<string, TransactionDTO[]>();
  for (const tx of transactions) {
    const key = tx.occurredAt.slice(0, 10);
    const bucket = groups.get(key);
    if (bucket) bucket.push(tx);
    else groups.set(key, [tx]);
  }
  return [...groups.entries()];
}

export default async function TransactionsPage() {
  const user = await requireUser();
  const [transactions, categories] = await Promise.all([
    listRecent(user.id),
    listCategories(user.id),
  ]);

  const categoryDtos = categories.map(toCategoryDTO);
  const days = groupByDay(transactions);

  return (
    <div className="space-y-5 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Transaksi</h1>
        <AddTransactionButton categories={categoryDtos} />
      </div>

      {days.length === 0 ? (
        <div className="rounded-3xl border bg-card p-10 text-center">
          <p className="text-4xl">🪙</p>
          <p className="mt-3 font-medium">Belum ada transaksi</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Catat pemasukan atau pengeluaran pertamamu.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {days.map(([day, items]) => (
            <section key={day} className="space-y-2">
              <h2 className="font-heading text-muted-foreground text-sm">
                {format(new Date(day), "EEEE, d MMM yyyy", {
                  locale: idLocale,
                })}
              </h2>
              <ul className="overflow-hidden rounded-3xl border bg-card">
                {items.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    transaction={tx}
                    categories={categoryDtos}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
