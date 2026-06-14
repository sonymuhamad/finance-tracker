"use client";

import { Check, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { CycleSwitcher } from "@/components/cycle-switcher";
import { Button } from "@/components/ui/button";
import {
  confirmObligationAction,
  confirmRecurringObligationAction,
} from "@/features/expenses/actions";
import {
  confirmIncomeAction,
  confirmRecurringIncomeAction,
} from "@/features/income/actions";
import { formatDateShort } from "@/lib/date";
import { formatCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ForecastItemDTO, HomeDTO } from "../types";

type Named = { id: string; name: string };
type Wallet = { id: string; name: string; emoji: string | null };
type Tag = { id: string; name: string; icon: string | null };

export function HomeView({
  home,
  firstName,
  wallets,
  cards,
  tags,
}: {
  home: HomeDTO;
  firstName: string;
  wallets: Wallet[];
  cards: Named[];
  tags: Tag[];
}) {
  const [pending, startTransition] = useTransition();
  const { forecast: f } = home;

  const walletName = (id: string) =>
    wallets.find((w) => w.id === id)?.name ?? "Dompet";
  const sourceLabel = (item: ForecastItemDTO) =>
    item.cardId
      ? (cards.find((c) => c.id === item.cardId)?.name ?? "Kartu")
      : walletName(item.walletId);
  const tagOf = (id: string | null) =>
    id ? tags.find((t) => t.id === id) : undefined;

  function onConfirm(item: ForecastItemDTO) {
    startTransition(async () => {
      const isIncome = item.kind === "income";
      const result = item.ruleId
        ? isIncome
          ? await confirmRecurringIncomeAction(item.ruleId, item.effectiveDate)
          : await confirmRecurringObligationAction(
              item.ruleId,
              item.effectiveDate,
            )
        : item.movementId
          ? isIncome
            ? await confirmIncomeAction(item.movementId)
            : await confirmObligationAction(item.movementId)
          : { ok: false as const, error: "Item tidak valid" };
      if (result.ok) toast.success(isIncome ? "Diterima 🎉" : "Dibayar ✓");
      else toast.error(result.error);
    });
  }

  const positive = f.z >= 0;

  return (
    <div className="space-y-5">
      {/* Header + cycle switcher (compact dropdown, per the mockup pill) */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl">
          Halo, {firstName} <span className="align-middle">👋</span>
        </h1>
        <CycleSwitcher
          strip={home.strip}
          current={f.cycle.offset}
          basePath="/"
        />
      </div>

      {/* Hero — Z */}
      <div className="rounded-3xl border bg-card p-6 text-center">
        <p className="flex items-center justify-center gap-1.5 text-muted-foreground text-sm">
          Aman dipakai sampai gajian
          {f.isProjected && (
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-[11px]">
              proyeksi
            </span>
          )}
        </p>
        <p
          className={cn(
            "mt-2 font-heading text-4xl tabular-nums",
            !positive && "text-destructive",
          )}
        >
          {formatCurrency(f.z)}
        </p>
        <p className="mt-1 text-muted-foreground text-xs">{f.cycle.label}</p>
        {positive ? (
          <p className="mt-3 text-sm">
            Biar aman: ~<b>{formatCurrency(f.perDayAllowance)}</b> / hari
            {!f.isProjected && ` · sisa ${f.daysLeft} hari`} 🙂
          </p>
        ) : (
          <p className="mt-3 text-destructive text-sm">
            Pengeluaran siklus ini lebih besar dari yang kamu punya — hati-hati.
          </p>
        )}
      </div>

      {/* X − Y */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-muted-foreground text-xs">Punya sekarang</p>
          <p className="mt-1 font-medium tabular-nums">{formatCurrency(f.x)}</p>
        </div>
        <span className="text-2xl text-muted-foreground">−</span>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-muted-foreground text-xs">Bakal keluar</p>
          <p className="mt-1 font-medium text-destructive tabular-nums">
            {formatCurrency(f.y)}
          </p>
        </div>
      </div>

      {/* Perlu konfirmasi */}
      {f.toConfirm.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-heading text-muted-foreground text-sm">
            Perlu konfirmasi
          </h2>
          <ul className="overflow-hidden rounded-3xl border bg-card">
            {f.toConfirm.map((item) => (
              <li
                key={`${item.movementId ?? item.ruleId}-${item.effectiveDate}`}
                className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-base">
                  {item.kind === "income"
                    ? "💰"
                    : tagOf(item.categoryId)?.icon || "💸"}
                </span>
                <div className="flex-1">
                  <div className="font-medium tabular-nums">
                    {formatCurrency(item.amount)}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {formatDateShort(item.effectiveDate)} · {sourceLabel(item)}
                    {item.note ? ` · ${item.note}` : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={item.kind === "income" ? "default" : "secondary"}
                  disabled={pending}
                  onClick={() => onConfirm(item)}
                  className="gap-1"
                >
                  <Check className="size-3.5" />
                  {item.kind === "income" ? "Terima" : "Bayar"}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Dompet breakdown */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-muted-foreground text-sm">Dompet</h2>
          <Link href="/wallets" className="text-primary text-sm">
            Atur
          </Link>
        </div>
        <ul className="overflow-hidden rounded-3xl border bg-card">
          {f.perWallet.length === 0 ? (
            <li className="p-4 text-muted-foreground text-sm">
              Belum ada dompet.
            </li>
          ) : (
            f.perWallet.map((w) => {
              const wallet = wallets.find((x) => x.id === w.walletId);
              return (
                <li
                  key={w.walletId}
                  className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-base">
                    {wallet?.emoji || "👛"}
                  </span>
                  <span className="flex-1 font-medium">
                    {wallet?.name ?? "Dompet"}
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(w.balance)}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </section>

      {/* Obligations (Y) */}
      <section className="space-y-2">
        <h2 className="font-heading text-muted-foreground text-sm">
          Jatuh tempo siklus ini
        </h2>
        <ul className="overflow-hidden rounded-3xl border bg-card">
          {f.obligations.length === 0 ? (
            <li className="p-4 text-muted-foreground text-sm">
              Nggak ada tagihan jatuh tempo. 🎉
            </li>
          ) : (
            f.obligations.map((item) => {
              const tag = tagOf(item.categoryId);
              return (
                <li
                  key={`${item.movementId ?? item.ruleId}-${item.effectiveDate}`}
                  className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-base">
                    {tag?.icon || (item.cardId ? "💳" : "🧾")}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium">
                      {tag?.name ?? sourceLabel(item)}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {formatDateShort(item.effectiveDate)} ·{" "}
                      {sourceLabel(item)}
                      {item.note ? ` · ${item.note}` : ""}
                    </div>
                  </div>
                  <span className="tabular-nums">
                    {formatCurrency(item.amount)}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </section>

      {/* Capture entry point */}
      <Link
        href="/expenses"
        className="flex items-center justify-between rounded-3xl border bg-primary p-4 text-primary-foreground"
      >
        <span className="flex items-center gap-2 font-medium">
          <Plus className="size-5" /> Catat pengeluaran
        </span>
        <ChevronRight className="size-5" />
      </Link>
    </div>
  );
}
