"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryDTO } from "@/features/categories/types";
import { TransactionType } from "@/generated/prisma/enums";
import { parseAmount } from "@/lib/money";
import { cn } from "@/lib/utils";
import { createTransactionAction, updateTransactionAction } from "../actions";
import type { TransactionDTO } from "../types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionFormDialog({
  categories,
  editing,
  trigger,
}: {
  categories: CategoryDTO[];
  editing?: TransactionDTO;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [type, setType] = useState<TransactionType>(
    editing?.type ?? TransactionType.EXPENSE,
  );
  const [categoryId, setCategoryId] = useState(editing?.category.id ?? "");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [occurredAt, setOccurredAt] = useState(
    editing ? editing.occurredAt.slice(0, 10) : today(),
  );
  const [note, setNote] = useState(editing?.note ?? "");

  const visibleCategories = categories.filter((c) => c.type === type);

  function changeType(next: TransactionType) {
    setType(next);
    // Reset the category if it no longer matches the chosen type.
    if (!categories.some((c) => c.id === categoryId && c.type === next)) {
      setCategoryId("");
    }
  }

  function submit() {
    const parsedAmount = parseAmount(amount);
    if (parsedAmount === null || parsedAmount <= 0) {
      toast.error("Jumlah harus lebih dari 0");
      return;
    }
    if (!categoryId) {
      toast.error("Pilih kategori dulu");
      return;
    }

    const fd = new FormData();
    fd.set("type", type);
    fd.set("amount", String(parsedAmount));
    fd.set("categoryId", categoryId);
    fd.set("occurredAt", occurredAt);
    if (note.trim()) fd.set("note", note.trim());
    if (editing) fd.set("id", editing.id);

    startTransition(async () => {
      const result = editing
        ? await updateTransactionAction(fd)
        : await createTransactionAction(fd);
      if (result.ok) {
        toast.success(editing ? "Transaksi diperbarui" : "Transaksi dicatat");
        setOpen(false);
        if (!editing) {
          // reset for the next quick entry
          setAmount("");
          setNote("");
        }
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Ubah transaksi" : "Catat transaksi"}
          </DialogTitle>
          <DialogDescription>
            Isi jumlah, kategori, dan tanggalnya.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type segmented toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1">
            {(
              [
                [TransactionType.EXPENSE, "Pengeluaran"],
                [TransactionType.INCOME, "Pemasukan"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => changeType(value)}
                className={cn(
                  "rounded-xl py-2 font-medium text-sm transition",
                  type === value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount">Jumlah</Label>
            <Input
              id="amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="text-lg"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Kategori</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                {visibleCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="occurredAt">Tanggal</Label>
            <Input
              id="occurredAt"
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Catatan (opsional)</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="mis. makan siang"
            />
          </div>

          <Button
            onClick={submit}
            disabled={pending}
            className="w-full"
            size="lg"
          >
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
