"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { TransactionType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "../actions";
import { type CreateCategoryInput, createCategorySchema } from "../schema";
import type { CategoryDTO } from "../types";

const SWATCHES = [
  "#f97362",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#10b981",
  "#22c55e",
  "#84cc16",
  "#06b6d4",
  "#a8a29e",
];

const TYPE_LABEL: Record<TransactionType, string> = {
  INCOME: "Pemasukan",
  EXPENSE: "Pengeluaran",
};

export function CategoryManager({ initial }: { initial: CategoryDTO[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryDTO | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      name: "",
      type: TransactionType.EXPENSE,
      color: SWATCHES[0],
      icon: "",
    },
  });

  function openCreate() {
    setEditing(null);
    form.reset({
      name: "",
      type: TransactionType.EXPENSE,
      color: SWATCHES[0],
      icon: "",
    });
    setOpen(true);
  }

  function openEdit(category: CategoryDTO) {
    setEditing(category);
    form.reset({
      name: category.name,
      type: category.type,
      color: category.color ?? SWATCHES[0],
      icon: category.icon ?? "",
    });
    setOpen(true);
  }

  const onSubmit = form.handleSubmit((values) => {
    const fd = new FormData();
    fd.set("name", values.name);
    fd.set("type", values.type);
    if (values.color) fd.set("color", values.color);
    if (values.icon) fd.set("icon", values.icon);
    if (editing) fd.set("id", editing.id);

    startTransition(async () => {
      const result = editing
        ? await updateCategoryAction(fd)
        : await createCategoryAction(fd);
      if (result.ok) {
        toast.success(editing ? "Kategori diperbarui" : "Kategori ditambahkan");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  });

  function onDelete(category: CategoryDTO) {
    if (!confirm(`Hapus kategori "${category.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteCategoryAction(category.id);
      if (result.ok) toast.success("Kategori dihapus");
      else toast.error(result.error);
    });
  }

  const groups = [TransactionType.EXPENSE, TransactionType.INCOME] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Kategori</h1>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="size-4" /> Tambah
        </Button>
      </div>

      {groups.map((type) => {
        const items = initial.filter((c) => c.type === type);
        return (
          <section key={type} className="space-y-2">
            <h2 className="font-heading text-muted-foreground text-sm">
              {TYPE_LABEL[type]}
            </h2>
            <ul className="overflow-hidden rounded-3xl border bg-card">
              {items.length === 0 ? (
                <li className="p-4 text-muted-foreground text-sm">
                  Belum ada kategori.
                </li>
              ) : (
                items.map((category) => (
                  <li
                    key={category.id}
                    className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                  >
                    <span
                      className="flex size-9 items-center justify-center rounded-full text-base"
                      style={{
                        backgroundColor: `${category.color ?? "#a8a29e"}22`,
                      }}
                    >
                      {category.icon || "🏷️"}
                    </span>
                    <span className="flex-1 font-medium">{category.name}</span>
                    <button
                      type="button"
                      onClick={() => openEdit(category)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
                      aria-label="Ubah"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(category)}
                      disabled={pending}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Hapus"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>
        );
      })}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Ubah kategori" : "Tambah kategori"}
            </DialogTitle>
            <DialogDescription>
              Kelompokkan transaksimu biar gampang dilihat.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nama</Label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder="mis. Makan"
              />
              {form.formState.errors.name && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Tipe</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(v) =>
                  form.setValue("type", v as TransactionType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TransactionType.EXPENSE}>
                    Pengeluaran
                  </SelectItem>
                  <SelectItem value={TransactionType.INCOME}>
                    Pemasukan
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="icon">Ikon</Label>
                <Input
                  id="icon"
                  {...form.register("icon")}
                  placeholder="🍜"
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
