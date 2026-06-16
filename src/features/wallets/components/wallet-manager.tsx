"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Star,
  Trash2,
  Wallet,
} from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  adjustWalletBalanceAction,
  createWalletAction,
  deleteWalletAction,
  restoreWalletAction,
  setPrimaryWalletAction,
  updateWalletAction,
} from "../actions";
import {
  type CreateWalletInput,
  createWalletSchema,
  type WalletTypeValue,
} from "../schema";
import type { ArchivedWalletDTO, WalletDTO } from "../types";

const SWATCHES = [
  "#f97362",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#10b981",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#a8a29e",
];

const TYPE_META: Record<WalletTypeValue, { label: string; emoji: string }> = {
  CASH: { label: "Tunai", emoji: "💵" },
  BANK: { label: "Bank", emoji: "🏦" },
  EWALLET: { label: "E-wallet", emoji: "📱" },
};

/** Form values for the create/edit dialog — defaults for a new wallet, or a
 * wallet's current attributes when editing. */
function toFormValues(wallet?: WalletDTO): CreateWalletInput {
  if (!wallet) {
    return {
      name: "",
      type: "CASH",
      startingBalance: 0,
      emoji: TYPE_META.CASH.emoji,
      color: SWATCHES[0],
      isPrimary: false,
    };
  }
  return {
    name: wallet.name,
    type: wallet.type,
    startingBalance: wallet.startingBalance,
    emoji: wallet.emoji ?? TYPE_META[wallet.type].emoji,
    color: wallet.color ?? SWATCHES[0],
    isPrimary: wallet.isPrimary,
  };
}

export function WalletManager({
  initial,
  pooled,
  archived,
}: {
  initial: WalletDTO[];
  pooled: number;
  archived: ArchivedWalletDTO[];
}) {
  const { confirm, confirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WalletDTO | null>(null);
  const [adjusting, setAdjusting] = useState<WalletDTO | null>(null);
  const [targetBalance, setTargetBalance] = useState("");
  const [note, setNote] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<CreateWalletInput>({
    // `startingBalance` uses z.coerce, so the schema's input type differs from its
    // output (CreateWalletInput); cast the resolver to the output shape.
    resolver: zodResolver(createWalletSchema) as Resolver<CreateWalletInput>,
    defaultValues: toFormValues(),
  });

  function openCreate() {
    setEditing(null);
    form.reset(toFormValues());
    setOpen(true);
  }

  function openEdit(wallet: WalletDTO) {
    setEditing(wallet);
    form.reset(toFormValues(wallet));
    setOpen(true);
  }

  function onTypeChange(type: WalletTypeValue) {
    form.setValue("type", type);
    if (!form.getValues("emoji")) form.setValue("emoji", TYPE_META[type].emoji);
  }

  const onSubmit = form.handleSubmit((values) => {
    const fd = new FormData();
    fd.set("name", values.name);
    fd.set("type", values.type);
    if (values.emoji) fd.set("emoji", values.emoji);
    if (values.color) fd.set("color", values.color);
    if (editing) {
      fd.set("id", editing.id);
    } else {
      fd.set("startingBalance", String(values.startingBalance ?? 0));
      if (values.isPrimary) fd.set("isPrimary", "true");
    }

    startTransition(async () => {
      const result = editing
        ? await updateWalletAction(fd)
        : await createWalletAction(fd);
      if (result.ok) {
        toast.success(editing ? "Dompet diperbarui" : "Dompet ditambahkan");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  });

  function openAdjust(wallet: WalletDTO) {
    setAdjusting(wallet);
    setTargetBalance(String(wallet.balance));
    setNote("");
  }

  function submitAdjust(e: FormEvent) {
    e.preventDefault();
    if (!adjusting) return;
    const fd = new FormData();
    fd.set("id", adjusting.id);
    fd.set("targetBalance", targetBalance);
    if (note) fd.set("note", note);
    startTransition(async () => {
      const result = await adjustWalletBalanceAction(fd);
      if (result.ok) {
        toast.success("Saldo disesuaikan");
        setAdjusting(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  function onSetPrimary(wallet: WalletDTO) {
    startTransition(async () => {
      const result = await setPrimaryWalletAction(wallet.id);
      if (result.ok) toast.success(`${wallet.name} jadi dompet utama`);
      else toast.error(result.error);
    });
  }

  async function onDelete(wallet: WalletDTO) {
    if (
      !(await confirm({
        title: `Hapus dompet "${wallet.name}"?`,
        confirmLabel: "Hapus",
        destructive: true,
      }))
    )
      return;
    startTransition(async () => {
      const result = await deleteWalletAction(wallet.id);
      if (result.ok) {
        toast.success(
          result.archived
            ? "Dompet diarsipkan (masih ada riwayat)"
            : "Dompet dihapus",
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  function onRestore(wallet: ArchivedWalletDTO) {
    startTransition(async () => {
      const result = await restoreWalletAction(wallet.id);
      if (result.ok) toast.success("Dompet dipulihkan");
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Dompet</h1>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="size-4" /> Tambah
        </Button>
      </div>

      {/* Pooled total = X "Punya sekarang" */}
      <div className="rounded-3xl border bg-card p-5">
        <p className="text-muted-foreground text-sm">Punya sekarang</p>
        <p className="mt-1 font-heading text-3xl tabular-nums">
          {formatCurrency(pooled)}
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          Total saldo semua dompet aktif, digabung.
        </p>
      </div>

      {initial.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Belum ada dompet"
          subtitle="Tambah dompet (cash, bank, e-wallet) buat mulai nyatet saldo."
          action={{ label: "Tambah dompet", onClick: openCreate }}
        />
      ) : (
        <ul className="overflow-hidden rounded-3xl border bg-card">
          {initial.map((wallet) => (
            <li
              key={wallet.id}
              className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
            >
              <span
                className="flex size-10 items-center justify-center rounded-full text-lg"
                style={{ backgroundColor: `${wallet.color ?? "#a8a29e"}22` }}
              >
                {wallet.emoji || TYPE_META[wallet.type].emoji}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{wallet.name}</span>
                  {wallet.isPrimary && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-[11px] text-primary">
                      Utama
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground text-sm tabular-nums">
                  {formatCurrency(wallet.balance)}
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  className="rounded-lg p-3 text-muted-foreground hover:bg-secondary"
                  aria-label={`Aksi untuk ${wallet.name}`}
                  disabled={pending}
                >
                  <MoreVertical className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={() => openEdit(wallet)}
                  >
                    <Pencil className="size-4" /> Ubah
                  </DropdownMenuItem>
                  {!wallet.isPrimary && (
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => onSetPrimary(wallet)}
                    >
                      <Star className="size-4" /> Jadikan utama
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={() => openAdjust(wallet)}
                  >
                    <SlidersHorizontal className="size-4" /> Sesuaikan saldo
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onSelect={() => onDelete(wallet)}
                  >
                    <Trash2 className="size-4" /> Hapus
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setShowArchive((v) => !v)}
            className="font-heading text-muted-foreground text-sm hover:text-foreground"
          >
            Arsip ({archived.length}) {showArchive ? "▾" : "▸"}
          </button>
          {showArchive && (
            <ul className="overflow-hidden rounded-3xl border bg-card">
              {archived.map((wallet) => (
                <li
                  key={wallet.id}
                  className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-base opacity-70">
                    {wallet.emoji || TYPE_META[wallet.type].emoji}
                  </span>
                  <span className="flex-1 text-muted-foreground">
                    {wallet.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRestore(wallet)}
                    disabled={pending}
                    className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-muted-foreground text-sm hover:bg-secondary hover:text-foreground"
                  >
                    <RotateCcw className="size-3.5" /> Pulihkan
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Create / Edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Ubah dompet" : "Tambah dompet"}
            </DialogTitle>
            <DialogDescription>
              Dompet menyimpan uang aslimu — cash, bank, atau e-wallet.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nama</Label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder="mis. BCA"
              />
              {form.formState.errors.name && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Jenis</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(v) => onTypeChange(v as WalletTypeValue)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_META) as WalletTypeValue[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {TYPE_META[type].emoji} {TYPE_META[type].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!editing && (
              <div className="space-y-1.5">
                <Label htmlFor="startingBalance">Saldo sekarang</Label>
                <CurrencyInput
                  id="startingBalance"
                  value={String(form.watch("startingBalance") ?? "")}
                  onValueChange={(raw) =>
                    form.setValue(
                      "startingBalance",
                      raw === "" ? 0 : Number(raw),
                      { shouldValidate: true },
                    )
                  }
                  placeholder="0"
                />
                {form.formState.errors.startingBalance && (
                  <p className="text-destructive text-sm">
                    {form.formState.errors.startingBalance.message}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-[auto_1fr] gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="emoji">Ikon</Label>
                <Input
                  id="emoji"
                  {...form.register("emoji")}
                  className="w-20 text-center text-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Warna</Label>
                <div className="flex flex-wrap gap-2 pt-1.5">
                  {SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => form.setValue("color", color)}
                      className={cn(
                        "size-7 rounded-full ring-offset-2 transition",
                        form.watch("color") === color && "ring-2 ring-ring",
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Warna ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {!editing && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  {...form.register("isPrimary")}
                />
                Jadikan dompet utama
              </label>
            )}

            <DialogFooter>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjust balance */}
      <Dialog
        open={adjusting !== null}
        onOpenChange={(v) => !v && setAdjusting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sesuaikan saldo</DialogTitle>
            <DialogDescription>
              {adjusting
                ? `Saldo ${adjusting.name} sekarang ${formatCurrency(adjusting.balance)}. Masukkan saldo aslinya — selisihnya dicatat sebagai penyesuaian.`
                : null}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitAdjust} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="targetBalance">Saldo asli</Label>
              <CurrencyInput
                id="targetBalance"
                required
                value={targetBalance}
                onValueChange={setTargetBalance}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">Catatan (opsional)</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="mis. koreksi setelah cek mutasi"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
