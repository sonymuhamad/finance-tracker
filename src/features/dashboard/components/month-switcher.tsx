"use client";

import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatMonthParam, shiftMonth } from "../period";

export function MonthSwitcher({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const router = useRouter();

  function go(delta: number) {
    const next = shiftMonth(year, month, delta);
    router.push(`/?m=${formatMonthParam(next.year, next.month)}`);
  }

  const label = format(new Date(Date.UTC(year, month - 1, 1)), "MMMM yyyy", {
    locale: idLocale,
  });

  return (
    <div className="flex items-center justify-between rounded-2xl border bg-card px-2 py-1.5">
      <button
        type="button"
        onClick={() => go(-1)}
        className="rounded-xl p-2 text-muted-foreground hover:bg-secondary"
        aria-label="Bulan sebelumnya"
      >
        <ChevronLeft className="size-5" />
      </button>
      <span className="font-heading font-medium capitalize">{label}</span>
      <button
        type="button"
        onClick={() => go(1)}
        className="rounded-xl p-2 text-muted-foreground hover:bg-secondary"
        aria-label="Bulan berikutnya"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
