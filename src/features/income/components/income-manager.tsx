"use client";

import {
  Banknote,
  CalendarClock,
  Check,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatDateShort } from "@/lib/date";
import { formatCurrency } from "@/lib/money";
import {
  addOneOffIncomeAction,
  addRecurringIncomeAction,
  confirmIncomeAction,
  confirmRecurringIncomeAction,
  deleteIncomeAction,
  endRecurringIncomeAction,
  setPrimaryIncomeAction,
  updateIncomeAction,
  updateRecurringIncomeAction,
} from "../actions";
import type {
  IncomeItemDTO,
  IncomeViewDTO,
  RecurringIncomeDTO,
} from "../types";

type Wallet = { id: string; name: string; emoji: string | null };
type Tag = { id: string; name: string; icon: string | null };
type DialogKind = "primary" | "recurring" | "oneoff" | "edit" | null;

const NO_TAG = "none";
const KIND_LABEL: Record<IncomeItemDTO["kind"], string> = {
  received: "Diterima",
  expected: "Menunggu",
  projected: "Proyeksi",
};

function todayInput() {
  // Local calendar date (YYYY-MM-DD), not UTC — so a late-evening entry in
  // Asia/Jakarta doesn't default to yesterday.
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function IncomeManager({
  view,
  wallets,
  tags,
}: {
  view: IncomeViewDTO;
  wallets: Wallet[];
  tags: Tag[];
}) {
  const { confirm, confirmDialog } = useConfirm();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const defaultWallet = view.primary?.walletId ?? wallets[0]?.id ?? "";
  const [amount, setAmount] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("25");
  const [date, setDate] = useState(todayInput());
  const [walletId, setWalletId] = useState(defaultWallet);
  const [categoryId, setCategoryId] = useState(NO_TAG);
  const [note, setNote] = useState("");
  const [received, setReceived] = useState(false);

  // Edit one-off income form (dedicated state — the create dialog is shared).
  const [editMovementId, setEditMovementId] = useState<string | null>(null);
  const [edAmount, setEdAmount] = useState("");
  const [edDate, setEdDate] = useState(todayInput());
  const [edCategoryId, setEdCategoryId] = useState(NO_TAG);
  const [edNote, setEdNote] = useState("");

  const walletName = (id: string) =>
    wallets.find((w) => w.id === id)?.name ?? "—";
  const tagOf = (id: string | null) =>
    id ? tags.find((t) => t.id === id) : undefined;

  function resetForm(
    over: Partial<{ amount: string; dayOfMonth: string }> = {},
  ) {
    setAmount(over.amount ?? "");
    setDayOfMonth(over.dayOfMonth ?? "25");
    setDate(todayInput());
    setWalletId(defaultWallet);
    setCategoryId(NO_TAG);
    setNote("");
    setReceived(false);
  }

  function openPrimary() {
    setEditingId(null);
    resetForm();
    if (view.primary) {
      setAmount(String(view.primary.amount));
      setDayOfMonth(String(view.primary.dayOfMonth));
      setWalletId(view.primary.walletId);
      setCategoryId(view.primary.categoryId ?? NO_TAG);
      setNote(view.primary.note ?? "");
    }
    setDialog("primary");
  }

  function openRecurring(rule?: RecurringIncomeDTO) {
    setEditingId(rule?.id ?? null);
    resetForm({ dayOfMonth: rule ? String(rule.dayOfMonth) : "1" });
    if (rule) {
      setAmount(String(rule.amount));
      setWalletId(rule.walletId);
      setCategoryId(rule.categoryId ?? NO_TAG);
      setNote(rule.note ?? "");
    }
    setDialog("recurring");
  }

  function openOneOff() {
    setEditingId(null);
    resetForm();
    setDialog("oneoff");
  }

  function buildBase(fd: FormData) {
    fd.set("amount", amount);
    fd.set("walletId", walletId);
    if (categoryId !== NO_TAG) fd.set("categoryId", categoryId);
    if (note) fd.set("note", note);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();

    // Changing the payday re-anchors every cycle, so past income/expenses can
    // shift between cycles (the data isn't lost, just re-bucketed). Warn first.
    if (
      dialog === "primary" &&
      view.primary &&
      Number(dayOfMonth) !== view.primary.dayOfMonth
    ) {
      const ok = await confirm({
        title: "Ubah tanggal gajian?",
        description:
          "Semua siklus bakal bergeser — pengeluaran & pemasukan lama bisa pindah siklus. Datanya nggak hilang, cuma dikelompokin ulang.",
        confirmLabel: "Ya, ubah",
      });
      if (!ok) return;
    }

    const fd = new FormData();
    buildBase(fd);

    startTransition(async () => {
      let result: { ok: boolean; error?: string };
      if (dialog === "oneoff") {
        fd.set("date", date);
        if (received) fd.set("received", "true");
        result = await addOneOffIncomeAction(fd);
      } else {
        fd.set("dayOfMonth", dayOfMonth);
        if (dialog === "primary") {
          result = await setPrimaryIncomeAction(fd);
        } else if (editingId) {
          fd.set("id", editingId);
          result = await updateRecurringIncomeAction(fd);
        } else {
          result = await addRecurringIncomeAction(fd);
        }
      }
      if (result.ok) {
        toast.success("Tersimpan");
        setDialog(null);
      } else {
        toast.error(result.error ?? "Gagal menyimpan");
      }
    });
  }

  async function onEndRecurring(rule: RecurringIncomeDTO) {
    if (
      !(await confirm({
        title: "Hentikan pemasukan rutin ini?",
        description: "Riwayat yang sudah ada tetap aman.",
        confirmLabel: "Hentikan",
        destructive: true,
      }))
    )
      return;
    startTransition(async () => {
      const result = await endRecurringIncomeAction(rule.id);
      if (result.ok) toast.success("Pemasukan rutin dihentikan");
      else toast.error(result.error);
    });
  }

  function onConfirm(item: IncomeItemDTO) {
    startTransition(async () => {
      const result =
        item.kind === "projected" && item.ruleId
          ? await confirmRecurringIncomeAction(item.ruleId, item.effectiveDate)
          : item.movementId
            ? await confirmIncomeAction(item.movementId)
            : { ok: false as const, error: "Item tidak valid" };
      if (result.ok) toast.success("Pemasukan diterima 🎉");
      else toast.error(result.error);
    });
  }

  function openEditIncome(item: IncomeItemDTO) {
    if (!item.movementId) return;
    setEditMovementId(item.movementId);
    setEdAmount(String(item.amount));
    setEdDate(item.effectiveDate.slice(0, 10));
    setEdCategoryId(item.categoryId ?? NO_TAG);
    setEdNote(item.note ?? "");
    setDialog("edit");
  }
  function submitEditIncome(e: FormEvent) {
    e.preventDefault();
    if (!editMovementId) return;
    const fd = new FormData();
    fd.set("movementId", editMovementId);
    fd.set("amount", edAmount);
    fd.set("date", edDate);
    if (edCategoryId !== NO_TAG) fd.set("categoryId", edCategoryId);
    if (edNote) fd.set("note", edNote);
    startTransition(async () => {
      const result = await updateIncomeAction(fd);
      if (result.ok) {
        toast.success("Pemasukan diperbarui");
        setDialog(null);
      } else {
        toast.error(result.error);
      }
    });
  }
  async function onDeleteIncome(item: IncomeItemDTO) {
    if (!item.movementId) return;
    if (
      !(await confirm({
        title: "Hapus pemasukan ini?",
        confirmLabel: "Hapus",
        destructive: true,
      }))
    )
      return;
    const id = item.movementId;
    startTransition(async () => {
      const result = await deleteIncomeAction(id);
      if (result.ok) toast.success("Pemasukan dihapus");
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Pemasukan</h1>
        <Button onClick={openOneOff} className="gap-1.5">
          <Plus className="size-4" /> Tambah
        </Button>
      </div>

      {/* Cycle banner */}
      <div className="rounded-3xl border bg-card p-5">
        <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
          <CalendarClock className="size-4" /> Siklus gajian ini
        </p>
        <p className="mt-1 font-heading text-2xl">{view.cycle.label}</p>
        {!view.hasPrimaryIncome && (
          <p className="mt-1 text-muted-foreground text-xs">
            Belum ada gaji utama — siklus pakai bulan kalender. Atur gaji utama
            biar siklusnya pas.
          </p>
        )}
      </div>

      {/* Primary income */}
      <section className="space-y-2">
        <h2 className="font-heading text-muted-foreground text-sm">
          Gaji utama
        </h2>
        <div className="rounded-3xl border bg-card p-4">
          {view.primary ? (
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-lg">
                💰
              </span>
              <div className="flex-1">
                <div className="font-medium tabular-nums">
                  {formatCurrency(view.primary.amount)}
                </div>
                <div className="text-muted-foreground text-sm">
                  Tiap tanggal {view.primary.dayOfMonth} →{" "}
                  {walletName(view.primary.walletId)}
                </div>
              </div>
              <button
                type="button"
                onClick={openPrimary}
                className="rounded-lg p-3 text-muted-foreground hover:bg-secondary"
                aria-label="Ubah gaji utama"
              >
                <Pencil className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                Belum diatur — ini yang nge-anchor siklus gajianmu.
              </p>
              <Button size="sm" variant="secondary" onClick={openPrimary}>
                Atur
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Secondary recurring sources */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-muted-foreground text-sm">
            Pemasukan rutin lain
          </h2>
          <button
            type="button"
            onClick={() => openRecurring()}
            className="flex items-center gap-1 text-primary text-sm"
          >
            <Plus className="size-3.5" /> Tambah rutin
          </button>
        </div>
        {view.recurringSources.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="Belum ada pemasukan rutin lain"
            subtitle="Misal bonus tetap atau sampingan bulanan — biar muncul otomatis tiap siklus."
            action={{
              label: "Tambah rutin",
              onClick: () => openRecurring(),
            }}
          />
        ) : (
          <ul className="overflow-hidden rounded-3xl border bg-card">
            {view.recurringSources.map((rule) => (
              <li
                key={rule.id}
                className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-base">
                  <Repeat className="size-4" />
                </span>
                <div className="flex-1">
                  <div className="font-medium tabular-nums">
                    {formatCurrency(rule.amount)}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    Tiap tanggal {rule.dayOfMonth} → {walletName(rule.walletId)}
                    {rule.note ? ` · ${rule.note}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openRecurring(rule)}
                  className="rounded-lg p-3 text-muted-foreground hover:bg-secondary"
                  aria-label="Ubah"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onEndRecurring(rule)}
                  disabled={pending}
                  className="rounded-lg p-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Hentikan"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* This cycle's income */}
      <section className="space-y-2">
        <h2 className="font-heading text-muted-foreground text-sm">
          Pemasukan siklus ini
        </h2>
        {view.items.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title={
              view.cycle.isCurrent
                ? "Belum ada pemasukan"
                : "Belum ada pemasukan terjadwal"
            }
            subtitle={
              view.cycle.isCurrent
                ? "Catat pemasukan pertamamu di siklus ini."
                : "Pemasukan rutin & rencana bakal muncul di sini otomatis."
            }
            action={
              view.cycle.isCurrent
                ? { label: "Tambah pemasukan", onClick: openOneOff }
                : undefined
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-3xl border bg-card">
            {view.items.map((item) => {
              const tag = tagOf(item.categoryId);
              return (
                <li
                  key={`${item.kind}-${item.movementId ?? item.ruleId}-${item.effectiveDate}`}
                  className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-base">
                    {tag?.icon || "💵"}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium tabular-nums">
                      {formatCurrency(item.amount)}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {formatDateShort(item.effectiveDate)} ·{" "}
                      {walletName(item.walletId)}
                      {tag ? ` · ${tag.name}` : ""}
                      {item.note ? ` · ${item.note}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {item.kind === "received" ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-[11px] text-primary">
                        {KIND_LABEL[item.kind]}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => onConfirm(item)}
                        className="gap-1"
                      >
                        <Check className="size-3.5" /> Terima
                      </Button>
                    )}
                    {/* One-off, not-yet-received income is editable; once
                        received (kind "received") it's locked. */}
                    {item.movementId &&
                      !item.ruleId &&
                      item.kind === "expected" && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditIncome(item)}
                            className="rounded-lg p-3 text-muted-foreground hover:bg-secondary"
                            aria-label="Ubah"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteIncome(item)}
                            disabled={pending}
                            className="rounded-lg p-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Hapus"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Shared create/edit-recurring dialog (the one-off edit has its own). */}
      <Dialog
        open={
          dialog === "primary" || dialog === "recurring" || dialog === "oneoff"
        }
        onOpenChange={(v) => !v && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "primary"
                ? "Gaji utama"
                : dialog === "recurring"
                  ? editingId
                    ? "Ubah pemasukan rutin"
                    : "Pemasukan rutin"
                  : "Tambah pemasukan"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "primary"
                ? "Gaji utama nge-anchor siklus. Tanggal 1–28."
                : dialog === "recurring"
                  ? "Pemasukan yang berulang tiap bulan."
                  : "Pemasukan sekali — sudah diterima atau diharapkan nanti."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Jumlah</Label>
              <CurrencyInput
                id="amount"
                required
                value={amount}
                onValueChange={setAmount}
                placeholder="0"
              />
            </div>

            {dialog === "oneoff" ? (
              <div className="space-y-1.5">
                <Label htmlFor="date">Tanggal</Label>
                <DatePicker id="date" value={date} onValueChange={setDate} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="dayOfMonth">Tanggal tiap bulan</Label>
                <Input
                  id="dayOfMonth"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={dialog === "primary" ? 28 : 31}
                  required
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                />
                {dialog !== "primary" && Number(dayOfMonth) >= 29 && (
                  <p className="text-muted-foreground text-xs">
                    Tanggal 29–31 bisa terlewat di bulan pendek (mis. Februari).
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Masuk ke dompet</Label>
              <Select value={walletId} onValueChange={setWalletId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih dompet" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.emoji ? `${w.emoji} ` : ""}
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Tag</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TAG}>Tanpa tag</SelectItem>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.icon ? `${t.icon} ` : ""}
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note">Catatan (opsional)</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="mis. gaji bulanan"
              />
            </div>

            {dialog === "oneoff" && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={received}
                  onChange={(e) => setReceived(e.target.checked)}
                />
                Sudah diterima (langsung masuk saldo)
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

      {/* Edit one-off income */}
      <Dialog
        open={dialog === "edit"}
        onOpenChange={(v) => !v && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah pemasukan</DialogTitle>
            <DialogDescription>
              Ubah jumlah, tanggal, tag, atau catatan.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEditIncome} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edAmount">Jumlah</Label>
              <CurrencyInput
                id="edAmount"
                required
                value={edAmount}
                onValueChange={setEdAmount}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edDate">Tanggal</Label>
              <DatePicker
                id="edDate"
                value={edDate}
                onValueChange={setEdDate}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tag</Label>
              <Select value={edCategoryId} onValueChange={setEdCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TAG}>Tanpa tag</SelectItem>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.icon ? `${t.icon} ` : ""}
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edNote">Catatan (opsional)</Label>
              <Input
                id="edNote"
                value={edNote}
                onChange={(e) => setEdNote(e.target.value)}
                placeholder="mis. gaji bulanan"
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
