/**
 * Throwaway end-to-end smoke test of the data layer against the local DB.
 * Run: bun run scripts/smoke.ts  (creates a temp user, then deletes it)
 */
import { listCategories } from "@/features/categories/service";
import { getMonthlySummary } from "@/features/dashboard/service";
import { createTransaction, listRecent } from "@/features/transactions/service";
import { prisma } from "@/lib/prisma";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "smoke@example.com" },
    update: {},
    create: { email: "smoke@example.com", name: "Smoke Test" },
  });

  try {
    const cats = await listCategories(user.id);
    const expense = cats.find((c) => c.type === "EXPENSE");
    const income = cats.find((c) => c.type === "INCOME");
    if (!expense || !income) throw new Error("default categories missing");

    await createTransaction(user.id, {
      type: "EXPENSE",
      amount: 15000,
      categoryId: expense.id,
      occurredAt: new Date("2026-06-02"),
      note: "makan siang",
    });
    await createTransaction(user.id, {
      type: "INCOME",
      amount: 5000000,
      categoryId: income.id,
      occurredAt: new Date("2026-06-01"),
    });

    const recent = await listRecent(user.id, 10);
    const summary = await getMonthlySummary(user.id, 2026, 6);

    console.log("categories seeded:", cats.length);
    console.log("recent count:", recent.length);
    console.log("summary:", JSON.stringify(summary, null, 2));

    if (summary.income !== 5000000) throw new Error("income mismatch");
    if (summary.expense !== 15000) throw new Error("expense mismatch");
    if (summary.net !== 4985000) throw new Error("net mismatch");
    console.log("✅ data layer OK");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    console.log("🧹 cleaned up temp user");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ smoke failed:", e);
    process.exit(1);
  });
