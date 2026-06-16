"use client";

import {
  Check,
  ChevronRight,
  CreditCard,
  Pencil,
  Plus,
  Receipt,
  Repeat,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  type ComponentType,
  type FormEvent,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { CycleSwitcher } from "@/components/cycle-switcher";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCardAction,
  deleteCardAction,
  updateCardAction,
} from "@/features/cards/actions";
import type { CardDTO } from "@/features/cards/types";
import { cycleOf, getCycleByOffset } from "@/lib/cycle";
import { formatDateShort } from "@/lib/date";
import { formatCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  addRecurringObligationAction,
  adjustObligationOccurrenceAction,
  confirmObligationAction,
  confirmRecurringObligationAction,
  deleteExpenseAction,
  endRecurringObligationAction,
  recordExpenseAction,
  restoreObligationOccurrenceAction,
  skipObligationOccurrenceAction,
  updateExpenseAction,
  updateRecurringObligationAction,
} from "../actions";
import { nextDueDate } from "../timing";
import type {
  ExpenseItemDTO,
  ExpenseViewDTO,
  RecurringObligationDTO,
} from "../types";

type Wallet = { id: string; name: string; emoji: string | null };
type Tag = { id: string; name: string; icon: string | null };
type Method = "CASH" | "CREDIT_CARD" | "PAYLATER";
type DialogKind = "expense" | "editExpense" | "card" | "obligation" | null;

const NO_TAG = "none";
const METHODS: { value: Method; label: string; emoji: string }[] = [
  { value: "CASH", label: "Cash", emoji: "💵" },
  { value: "CREDIT_CARD", label: "Kartu Kredit", emoji: "💳" },
  { value: "PAYLATER", label: "Paylater", emoji: "🕒" },
];
const CARD_KIND: { value: "CREDIT_CARD" | "PAYLATER"; label: string }[] = [
  { value: "CREDIT_CARD", label: "Kartu Kredit" },
  { value: "PAYLATER", label: "Paylater" },
];
const ITEM_LABEL: Record<ExpenseItemDTO["kind"], string> = {
  paid: "Lunas",
  due: "Jatuh tempo",
  projected: "Rutin",
  skipped: "Dilewati",
};

function todayInput() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
function dateToInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

type Recap = {
  z: number; // "aman dipakai sampai gajian" — from the home forecast
  perDay: number;
  isProjected: boolean;
};

/** Friendly empty state: icon + message + an optional inline action. Keeps an
 * empty section from rendering as a bare header (the page felt hollow before). */
function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed bg-card px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
        <Icon className="size-6" />
      </span>
      <p className="font-medium">{title}</p>
      <p className="max-w-xs text-muted-foreground text-sm">{subtitle}</p>
      {action && (
        <Button
          onClick={action.onClick}
          variant="secondary"
          size="sm"
          className="mt-1 gap-1.5"
        >
          <Plus className="size-4" /> {action.label}
        </Button>
      )}
    </div>
  );
}

export function ExpenseManager({
  view,
  recap,
  cards,
  wallets,
  tags,
}: {
  view: ExpenseViewDTO;
  recap: Recap;
  cards: CardDTO[];
  wallets: Wallet[];
  tags: Tag[];
}) {
  const { summary } = view;
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [pending, startTransition] = useTransition();
  const defaultWallet = wallets[0]?.id ?? "";

  // Expense capture form
  const [exAmount, setExAmount] = useState("");
  const [exMethod, setExMethod] = useState<Method>("CASH");
  const [exWalletId, setExWalletId] = useState(defaultWallet);
  const [exCardId, setExCardId] = useState(cards[0]?.id ?? "");
  const [exDueDate, setExDueDate] = useState("");
  const [exCategoryId, setExCategoryId] = useState(NO_TAG);
  const [exDate, setExDate] = useState(todayInput());
  const [exNote, setExNote] = useState("");
  // Cash only: when off, the expense is a future *plan* (PLANNED) that doesn't
  // deduct until confirmed, instead of being paid now.
  const [exPaid, setExPaid] = useState(true);

  // Edit dialog — either a one-off movement (editingExpId) or a per-cycle override
  // on a recurring occurrence (editOccurrence). Exactly one is set at a time.
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [editOccurrence, setEditOccurrence] = useState<{
    ruleId: string;
    occurrenceDate: string;
  } | null>(null);
  const [edAmount, setEdAmount] = useState("");
  const [edDate, setEdDate] = useState(todayInput());
  const [edCategoryId, setEdCategoryId] = useState(NO_TAG);
  const [edNote, setEdNote] = useState("");

  // Card form
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cName, setCName] = useState("");
  const [cKind, setCKind] = useState<"CREDIT_CARD" | "PAYLATER">("CREDIT_CARD");
  const [cDueDay, setCDueDay] = useState("1");
  const [cWalletId, setCWalletId] = useState(defaultWallet);

  // Recurring obligation form
  const [editingOblId, setEditingOblId] = useState<string | null>(null);
  const [oAmount, setOAmount] = useState("");
  const [oDay, setODay] = useState("1");
  const [oWalletId, setOWalletId] = useState(defaultWallet);
  const [oCategoryId, setOCategoryId] = useState(NO_TAG);
  const [oNote, setONote] = useState("");

  const walletName = (id: string) =>
    wallets.find((w) => w.id === id)?.name ?? "—";
  const cardOf = (id: string | null) =>
    id ? cards.find((c) => c.id === id) : undefined;
  const tagOf = (id: string | null) =>
    id ? tags.find((t) => t.id === id) : undefined;

  function defaultDueFor(cardId: string, dateStr: string) {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return "";
    return dateToInput(nextDueDate(card.defaultDueDay, new Date(dateStr)));
  }

  function openExpense() {
    setExAmount("");
    setExMethod("CASH");
    setExWalletId(defaultWallet);
    const firstCard = cards[0]?.id ?? "";
    setExCardId(firstCard);
    setExDate(todayInput());
    setExDueDate(firstCard ? defaultDueFor(firstCard, todayInput()) : "");
    setExCategoryId(NO_TAG);
    setExNote("");
    setExPaid(true);
    setDialog("expense");
  }

  function onMethodChange(m: Method) {
    setExMethod(m);
    if (m !== "CASH" && exCardId) {
      setExDueDate(defaultDueFor(exCardId, exDate));
    }
  }
  function onCardChange(id: string) {
    setExCardId(id);
    setExDueDate(defaultDueFor(id, exDate));
  }

  // Live impact preview (client-side, same pure cycle math as the server).
  const impact = (() => {
    const card = cardOf(exCardId);
    const eff =
      exMethod === "CASH"
        ? new Date(exDate)
        : exDueDate
          ? new Date(exDueDate)
          : card
            ? nextDueDate(card.defaultDueDay, new Date(exDate))
            : new Date(exDate);
    const today = new Date();
    const offset = cycleOf(view.anchorDay, today, eff);
    const cyc = getCycleByOffset(view.anchorDay, today, offset);
    if (exMethod === "CASH") {
      return exPaid
        ? `Langsung motong saldo sekarang · siklus ${cyc.label}`
        : `Direncanakan — belum motong saldo, masuk "bakal keluar" siklus ${cyc.label}`;
    }
    return `Nggak motong sekarang · nampar di siklus ${cyc.label}`;
  })();

  function submitExpense(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("amount", exAmount);
    fd.set("date", exDate);
    fd.set("method", exMethod);
    if (exMethod === "CASH") {
      fd.set("walletId", exWalletId);
      fd.set("paid", exPaid ? "true" : "false");
    } else {
      fd.set("cardId", exCardId);
      if (exDueDate) fd.set("dueDate", exDueDate);
    }
    if (exCategoryId !== NO_TAG) fd.set("categoryId", exCategoryId);
    if (exNote) fd.set("note", exNote);
    startTransition(async () => {
      const result = await recordExpenseAction(fd);
      if (result.ok) {
        toast.success("Pengeluaran dicatat");
        setDialog(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  // Edit a one-off movement (amount/date/category/note).
  function openEditExpense(item: ExpenseItemDTO) {
    if (!item.movementId) return;
    setEditOccurrence(null);
    setEditingExpId(item.movementId);
    setEdAmount(String(item.amount));
    setEdDate(item.effectiveDate.slice(0, 10));
    setEdCategoryId(item.categoryId ?? NO_TAG);
    setEdNote(item.note ?? "");
    setDialog("editExpense");
  }
  // Adjust a recurring occurrence's amount for this cycle only.
  function openAdjustOccurrence(item: ExpenseItemDTO) {
    if (!item.ruleId) return;
    setEditingExpId(null);
    setEditOccurrence({
      ruleId: item.ruleId,
      occurrenceDate: item.effectiveDate,
    });
    setEdAmount(String(item.amount));
    setDialog("editExpense");
  }
  function submitEditExpense(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      let result: { ok: boolean; error?: string };
      if (editOccurrence) {
        const fd = new FormData();
        fd.set("ruleId", editOccurrence.ruleId);
        fd.set("occurrenceDate", editOccurrence.occurrenceDate);
        fd.set("amount", edAmount);
        result = await adjustObligationOccurrenceAction(fd);
      } else if (editingExpId) {
        const fd = new FormData();
        fd.set("movementId", editingExpId);
        fd.set("amount", edAmount);
        fd.set("date", edDate);
        if (edCategoryId !== NO_TAG) fd.set("categoryId", edCategoryId);
        if (edNote) fd.set("note", edNote);
        result = await updateExpenseAction(fd);
      } else {
        return;
      }
      if (result.ok) {
        toast.success("Pengeluaran diperbarui");
        setDialog(null);
      } else {
        toast.error(result.error);
      }
    });
  }
  function onDeleteExpense(item: ExpenseItemDTO) {
    if (!item.movementId) return;
    if (!confirm("Hapus pengeluaran ini?")) return;
    const id = item.movementId;
    startTransition(async () => {
      const result = await deleteExpenseAction(id);
      if (result.ok) toast.success("Pengeluaran dihapus");
      else toast.error(result.error);
    });
  }
  // Skip a recurring occurrence this cycle (the rule keeps running next cycle).
  function onSkipOccurrence(item: ExpenseItemDTO) {
    if (!item.ruleId) return;
    if (!confirm("Lewati tagihan ini bulan ini? Aturan rutinnya tetap jalan."))
      return;
    const { ruleId, effectiveDate } = item;
    startTransition(async () => {
      const result = await skipObligationOccurrenceAction(
        ruleId,
        effectiveDate,
      );
      if (result.ok) toast.success("Tagihan dilewati bulan ini");
      else toast.error(result.error);
    });
  }
  function onRestoreOccurrence(item: ExpenseItemDTO) {
    if (!item.ruleId) return;
    const { ruleId, effectiveDate } = item;
    startTransition(async () => {
      const result = await restoreObligationOccurrenceAction(
        ruleId,
        effectiveDate,
      );
      if (result.ok) toast.success("Tagihan dipulihkan");
      else toast.error(result.error);
    });
  }

  function openCard(card?: CardDTO) {
    setEditingCardId(card?.id ?? null);
    setCName(card?.name ?? "");
    setCKind(card?.kind ?? "CREDIT_CARD");
    setCDueDay(String(card?.defaultDueDay ?? 1));
    setCWalletId(card?.payingWalletId ?? defaultWallet);
    setDialog("card");
  }
  function submitCard(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("name", cName);
    fd.set("kind", cKind);
    fd.set("defaultDueDay", cDueDay);
    fd.set("payingWalletId", cWalletId);
    if (editingCardId) fd.set("id", editingCardId);
    startTransition(async () => {
      const result = editingCardId
        ? await updateCardAction(fd)
        : await createCardAction(fd);
      if (result.ok) {
        toast.success(editingCardId ? "Kartu diperbarui" : "Kartu ditambahkan");
        setDialog(null);
      } else {
        toast.error(result.error);
      }
    });
  }
  function onDeleteCard(card: CardDTO) {
    if (!confirm(`Hapus kartu "${card.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteCardAction(card.id);
      if (result.ok) {
        toast.success(result.archived ? "Kartu diarsipkan" : "Kartu dihapus");
      } else {
        toast.error(result.error);
      }
    });
  }

  function openObligation(rule?: RecurringObligationDTO) {
    setEditingOblId(rule?.id ?? null);
    setOAmount(rule ? String(rule.amount) : "");
    setODay(String(rule?.dayOfMonth ?? 1));
    setOWalletId(rule?.walletId ?? defaultWallet);
    setOCategoryId(rule?.categoryId ?? NO_TAG);
    setONote(rule?.note ?? "");
    setDialog("obligation");
  }
  function submitObligation(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("amount", oAmount);
    fd.set("dayOfMonth", oDay);
    fd.set("walletId", oWalletId);
    if (oCategoryId !== NO_TAG) fd.set("categoryId", oCategoryId);
    if (oNote) fd.set("note", oNote);
    if (editingOblId) fd.set("id", editingOblId);
    startTransition(async () => {
      const result = editingOblId
        ? await updateRecurringObligationAction(fd)
        : await addRecurringObligationAction(fd);
      if (result.ok) {
        toast.success("Tersimpan");
        setDialog(null);
      } else {
        toast.error(result.error);
      }
    });
  }
  function onEndObligation(rule: RecurringObligationDTO) {
    if (!confirm("Hentikan tagihan rutin ini? (riwayat tetap aman)")) return;
    startTransition(async () => {
      const result = await endRecurringObligationAction(rule.id);
      if (result.ok) toast.success("Tagihan rutin dihentikan");
      else toast.error(result.error);
    });
  }

  function onConfirm(item: ExpenseItemDTO) {
    startTransition(async () => {
      const result =
        item.kind === "projected" && item.ruleId
          ? await confirmRecurringObligationAction(
              item.ruleId,
              item.effectiveDate,
            )
          : item.movementId
            ? await confirmObligationAction(item.movementId)
            : { ok: false as const, error: "Item tidak valid" };
      if (result.ok) toast.success("Tagihan dibayar ✓");
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Pengeluaran</h1>
        <Button onClick={openExpense} className="gap-1.5">
          <Plus className="size-4" /> Catat
        </Button>
      </div>

      {/* Spending summary — the at-a-glance the page was missing (#7). Totals
          come from the same items listed below, so the headline always matches. */}
      <section className="space-y-4 rounded-3xl border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-sm">
              {view.cycle.isCurrent ? "Siklus ini" : "Proyeksi siklus"}
            </p>
            <p className="mt-0.5 font-heading text-lg">{view.cycle.label}</p>
          </div>
          <CycleSwitcher
            strip={view.strip}
            current={view.cycle.offset}
            basePath="/expenses"
          />
        </div>

        <div className="border-t pt-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-muted-foreground text-sm">Total pengeluaran</p>
            {summary.count > 0 && (
              <span className="text-muted-foreground text-xs">
                {summary.count} item
              </span>
            )}
          </div>
          <p className="mt-1 font-heading text-3xl tabular-nums">
            {formatCurrency(summary.total)}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-secondary/50 p-3">
              <p className="text-muted-foreground text-xs">Sudah keluar</p>
              <p className="mt-0.5 font-medium tabular-nums">
                {formatCurrency(summary.spent)}
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/50 p-3">
              <p className="text-muted-foreground text-xs">Bakal keluar</p>
              <p className="mt-0.5 font-medium text-destructive tabular-nums">
                {formatCurrency(summary.upcoming)}
              </p>
            </div>
          </div>
        </div>

        {/* Safe-to-spend recap, so you don't bounce to Beranda while recording. */}
        <Link
          href="/"
          className="-mx-1 flex items-center justify-between gap-2 rounded-2xl bg-primary/5 px-3 py-3 transition hover:bg-primary/10"
        >
          <span className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4 shrink-0 text-primary" />
            <span>
              Aman dipakai{" "}
              <b
                className={cn(
                  "tabular-nums",
                  recap.z < 0 && "text-destructive",
                )}
              >
                {formatCurrency(recap.z)}
              </b>
              {recap.z >= 0 && !recap.isProjected && (
                <span className="text-muted-foreground">
                  {" "}
                  · ~{formatCurrency(recap.perDay)}/hari
                </span>
              )}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </section>

      {/* This cycle's expenses & obligations */}
      <section className="space-y-2">
        <h2 className="font-heading text-muted-foreground text-sm">
          Pengeluaran & tagihan siklus ini
        </h2>
        {view.items.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={
              view.cycle.isCurrent
                ? "Belum ada pengeluaran"
                : "Belum ada pengeluaran terjadwal"
            }
            subtitle={
              view.cycle.isCurrent
                ? "Catat pengeluaran pertamamu di siklus ini."
                : "Tagihan rutin & rencana bakal muncul di sini otomatis."
            }
            action={
              view.cycle.isCurrent
                ? { label: "Catat pengeluaran", onClick: openExpense }
                : undefined
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-3xl border bg-card">
            {view.items.map((item) => {
              const tag = tagOf(item.categoryId);
              const card = cardOf(item.cardId);
              return (
                <li
                  key={`${item.kind}-${item.movementId ?? item.ruleId}-${item.effectiveDate}`}
                  className={cn(
                    "flex items-center gap-3 border-b px-4 py-3 last:border-b-0",
                    item.kind === "skipped" && "opacity-60",
                  )}
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-base">
                    {tag?.icon || (item.cardId ? "💳" : "💸")}
                  </span>
                  <div className="flex-1">
                    <div
                      className={cn(
                        "font-medium tabular-nums",
                        item.kind === "skipped" && "line-through",
                      )}
                    >
                      {formatCurrency(item.amount)}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {formatDateShort(item.effectiveDate)} ·{" "}
                      {card ? card.name : walletName(item.walletId)}
                      {tag ? ` · ${tag.name}` : ""}
                      {item.note ? ` · ${item.note}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {item.kind === "paid" ? (
                      // Paid → locked (no edit/delete).
                      <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-[11px] text-muted-foreground">
                        {ITEM_LABEL.paid}
                      </span>
                    ) : item.kind === "skipped" ? (
                      <>
                        <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-[11px] text-muted-foreground">
                          {ITEM_LABEL.skipped}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRestoreOccurrence(item)}
                          disabled={pending}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
                          aria-label="Pulihkan"
                        >
                          <RotateCcw className="size-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        {view.cycle.isCurrent ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={pending}
                            onClick={() => onConfirm(item)}
                            className="gap-1"
                          >
                            <Check className="size-3.5" /> Bayar
                          </Button>
                        ) : (
                          // Future cycle — can't pay until we're in that period.
                          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-[11px] text-muted-foreground">
                            Terjadwal
                          </span>
                        )}
                        {/* Pending items are adjustable: one-off → edit/delete the
                            movement; recurring → adjust/skip just this cycle. */}
                        <button
                          type="button"
                          onClick={() =>
                            item.ruleId
                              ? openAdjustOccurrence(item)
                              : openEditExpense(item)
                          }
                          className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
                          aria-label="Ubah"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            item.ruleId
                              ? onSkipOccurrence(item)
                              : onDeleteExpense(item)
                          }
                          disabled={pending}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={item.ruleId ? "Lewati" : "Hapus"}
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

      {/* Recurring obligations */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-muted-foreground text-sm">
            Tagihan rutin
          </h2>
          <button
            type="button"
            onClick={() => openObligation()}
            className="flex items-center gap-1 text-primary text-sm"
          >
            <Plus className="size-3.5" /> Tambah
          </button>
        </div>
        {view.recurringObligations.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="Belum ada tagihan rutin"
            subtitle="Cicilan, SPP, langganan — biar muncul otomatis tiap siklus."
            action={{
              label: "Tambah tagihan rutin",
              onClick: () => openObligation(),
            }}
          />
        ) : (
          <ul className="overflow-hidden rounded-3xl border bg-card">
            {view.recurringObligations.map((rule) => (
              <li
                key={rule.id}
                className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-secondary">
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
                  onClick={() => openObligation(rule)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
                  aria-label="Ubah"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onEndObligation(rule)}
                  disabled={pending}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Hentikan"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Cards */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-muted-foreground text-sm">
            Kartu (kredit / paylater)
          </h2>
          <button
            type="button"
            onClick={() => openCard()}
            className="flex items-center gap-1 text-primary text-sm"
          >
            <Plus className="size-3.5" /> Tambah
          </button>
        </div>
        {cards.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Belum ada kartu"
            subtitle="Tambah kartu kredit / paylater buat nyatet cicilan & tagihannya."
            action={{ label: "Tambah kartu", onClick: () => openCard() }}
          />
        ) : (
          <ul className="overflow-hidden rounded-3xl border bg-card">
            {cards.map((card) => (
              <li
                key={card.id}
                className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-secondary">
                  <CreditCard className="size-4" />
                </span>
                <div className="flex-1">
                  <div className="font-medium">{card.name}</div>
                  <div className="text-muted-foreground text-sm">
                    Jatuh tempo tiap tgl {card.defaultDueDay} · bayar dari{" "}
                    {walletName(card.payingWalletId)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openCard(card)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
                  aria-label="Ubah"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteCard(card)}
                  disabled={pending}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Hapus"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Capture expense */}
      <Dialog
        open={dialog === "expense"}
        onOpenChange={(v) => !v && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catat pengeluaran</DialogTitle>
            <DialogDescription>
              Metode bayar nentuin kapan & siklus mana yang kena.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitExpense} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="exAmount">Berapa?</Label>
              <CurrencyInput
                id="exAmount"
                required
                value={exAmount}
                onValueChange={setExAmount}
                placeholder="0"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Metode bayar</Label>
              <div className="flex flex-wrap gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => onMethodChange(m.value)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition",
                      exMethod === m.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {m.emoji} {m.label}
                  </button>
                ))}
              </div>
            </div>

            {exMethod === "CASH" ? (
              <div className="space-y-1.5">
                <Label>Dari dompet</Label>
                <Select value={exWalletId} onValueChange={setExWalletId}>
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
            ) : cards.length === 0 ? (
              <p className="rounded-2xl bg-secondary p-3 text-muted-foreground text-sm">
                Belum ada kartu. Tambah kartu dulu di bawah biar bisa pakai CC /
                paylater.
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Kartu</Label>
                  <Select value={exCardId} onValueChange={onCardChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kartu" />
                    </SelectTrigger>
                    <SelectContent>
                      {cards.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exDue">Jatuh tempo</Label>
                  <DatePicker
                    id="exDue"
                    value={exDueDate}
                    onValueChange={setExDueDate}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={exCategoryId} onValueChange={setExCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TAG}>Tanpa kategori</SelectItem>
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
              <Label htmlFor="exDate">Tanggal transaksi</Label>
              <DatePicker
                id="exDate"
                value={exDate}
                onValueChange={setExDate}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exNote">Catatan (opsional)</Label>
              <Input
                id="exNote"
                value={exNote}
                onChange={(e) => setExNote(e.target.value)}
                placeholder="mis. sepatu lari"
              />
            </div>

            {exMethod === "CASH" && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={exPaid}
                  onChange={(e) => setExPaid(e.target.checked)}
                />
                Sudah dibayar (langsung motong saldo)
              </label>
            )}

            <div className="rounded-2xl bg-primary/5 p-3 text-sm">
              💡 {impact}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit one-off expense, or adjust a recurring occurrence (this cycle) */}
      <Dialog
        open={dialog === "editExpense"}
        onOpenChange={(v) => !v && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editOccurrence ? "Ubah jumlah bulan ini" : "Ubah pengeluaran"}
            </DialogTitle>
            <DialogDescription>
              {editOccurrence
                ? "Cuma berlaku siklus ini — aturan rutinnya tetap jalan bulan depan."
                : "Ubah jumlah, tanggal, kategori, atau catatan."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEditExpense} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edAmount">Berapa?</Label>
              <CurrencyInput
                id="edAmount"
                required
                value={edAmount}
                onValueChange={setEdAmount}
                placeholder="0"
              />
            </div>
            {/* One-off only — a recurring occurrence's date/tag come from its rule. */}
            {!editOccurrence && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="edDate">Tanggal</Label>
                  <DatePicker
                    id="edDate"
                    value={edDate}
                    onValueChange={setEdDate}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Kategori</Label>
                  <Select value={edCategoryId} onValueChange={setEdCategoryId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_TAG}>Tanpa kategori</SelectItem>
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
                    placeholder="mis. sepatu lari"
                  />
                </div>
              </>
            )}
            <DialogFooter>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Card form */}
      <Dialog
        open={dialog === "card"}
        onOpenChange={(v) => !v && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCardId ? "Ubah kartu" : "Tambah kartu"}
            </DialogTitle>
            <DialogDescription>
              Kartu kredit / paylater bayar dari satu dompet di tanggal jatuh
              temponya.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCard} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cName">Nama</Label>
              <Input
                id="cName"
                required
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="mis. CC BCA"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Jenis</Label>
              <Select
                value={cKind}
                onValueChange={(v) => setCKind(v as "CREDIT_CARD" | "PAYLATER")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARD_KIND.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cDueDay">Jatuh tempo tiap tanggal</Label>
              <Input
                id="cDueDay"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                required
                value={cDueDay}
                onChange={(e) => setCDueDay(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bayar dari dompet</Label>
              <Select value={cWalletId} onValueChange={setCWalletId}>
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
            <DialogFooter>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Recurring obligation form */}
      <Dialog
        open={dialog === "obligation"}
        onOpenChange={(v) => !v && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingOblId ? "Ubah tagihan rutin" : "Tagihan rutin"}
            </DialogTitle>
            <DialogDescription>
              Pengeluaran tetap tiap bulan (cicilan, SPP) — muncul otomatis tiap
              siklus.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitObligation} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="oAmount">Jumlah</Label>
              <CurrencyInput
                id="oAmount"
                required
                value={oAmount}
                onValueChange={setOAmount}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oDay">Jatuh tempo tiap tanggal</Label>
              <Input
                id="oDay"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                required
                value={oDay}
                onChange={(e) => setODay(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bayar dari dompet</Label>
              <Select value={oWalletId} onValueChange={setOWalletId}>
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
              <Label>Kategori</Label>
              <Select value={oCategoryId} onValueChange={setOCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TAG}>Tanpa kategori</SelectItem>
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
              <Label htmlFor="oNote">Catatan (opsional)</Label>
              <Input
                id="oNote"
                value={oNote}
                onChange={(e) => setONote(e.target.value)}
                placeholder="mis. cicilan pinjol"
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
    </div>
  );
}
