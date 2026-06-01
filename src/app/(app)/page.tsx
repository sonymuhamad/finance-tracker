import { requireUser } from "@/features/auth/service";
import { toCategoryDTO } from "@/features/categories/mapper";
import { listCategories } from "@/features/categories/service";
import { MonthSwitcher } from "@/features/dashboard/components/month-switcher";
import { parseMonthParam } from "@/features/dashboard/period";
import { getMonthlySummary } from "@/features/dashboard/service";
import { AddTransactionButton } from "@/features/transactions/components/add-transaction-button";
import { formatCurrency } from "@/lib/money";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const user = await requireUser();
  const { m } = await searchParams;
  const { year, month } = parseMonthParam(m, new Date());

  const [summary, categories] = await Promise.all([
    getMonthlySummary(user.id, year, month),
    listCategories(user.id),
  ]);

  const categoryDtos = categories.map(toCategoryDTO);

  const firstName = (user.name ?? user.email ?? "kamu").split(/[\s@]/)[0];
  const hasActivity = summary.income > 0 || summary.expense > 0;

  return (
    <div className="space-y-5 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl">
          Hai, {firstName} <span className="align-middle">👋</span>
        </h1>
        <AddTransactionButton categories={categoryDtos} />
      </div>

      <MonthSwitcher year={year} month={month} />

      {/* Net hero */}
      <div className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-sm">
        <p className="text-sm/none opacity-80">Sisa bulan ini</p>
        <p className="mt-2 font-heading text-4xl tracking-tight">
          {formatCurrency(summary.net)}
        </p>
        <p className="mt-1 text-sm opacity-80">
          {summary.net >= 0
            ? "Aman, masih surplus 🎉"
            : "Hati-hati, lagi defisit"}
        </p>
      </div>

      {/* Income / expense */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl border bg-card p-4">
          <p className="text-muted-foreground text-sm">Pemasukan</p>
          <p className="mt-1 font-heading text-emerald-600 text-xl">
            {formatCurrency(summary.income)}
          </p>
        </div>
        <div className="rounded-3xl border bg-card p-4">
          <p className="text-muted-foreground text-sm">Pengeluaran</p>
          <p className="mt-1 font-heading text-xl">
            {formatCurrency(summary.expense)}
          </p>
        </div>
      </div>

      {/* Expense breakdown */}
      <section className="space-y-3">
        <h2 className="font-heading text-muted-foreground text-sm">
          Pengeluaran per kategori
        </h2>

        {!hasActivity || summary.byCategory.length === 0 ? (
          <div className="rounded-3xl border bg-card p-10 text-center">
            <p className="text-4xl">📊</p>
            <p className="mt-3 font-medium">Belum ada data bulan ini</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Catat transaksi untuk melihat ke mana uangmu pergi.
            </p>
          </div>
        ) : (
          <ul className="space-y-3 rounded-3xl border bg-card p-4">
            {summary.byCategory.map((cat) => (
              <li key={cat.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">{cat.icon || "🏷️"}</span>
                  <span className="flex-1 font-medium">{cat.name}</span>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {formatCurrency(cat.total)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${cat.percentage}%`,
                      backgroundColor: cat.color ?? "var(--primary)",
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
