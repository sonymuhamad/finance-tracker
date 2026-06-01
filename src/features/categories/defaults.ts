import { TransactionType } from "@/generated/prisma/enums";

export type DefaultCategory = {
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
};

// Seeded once for a new user. Warm palette + friendly emoji.
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    name: "Makan",
    type: TransactionType.EXPENSE,
    color: "#f97362",
    icon: "🍜",
  },
  {
    name: "Transport",
    type: TransactionType.EXPENSE,
    color: "#f59e0b",
    icon: "🚗",
  },
  {
    name: "Belanja",
    type: TransactionType.EXPENSE,
    color: "#ec4899",
    icon: "🛍️",
  },
  {
    name: "Tagihan",
    type: TransactionType.EXPENSE,
    color: "#8b5cf6",
    icon: "🧾",
  },
  {
    name: "Hiburan",
    type: TransactionType.EXPENSE,
    color: "#14b8a6",
    icon: "🎬",
  },
  {
    name: "Kesehatan",
    type: TransactionType.EXPENSE,
    color: "#10b981",
    icon: "💊",
  },
  {
    name: "Lainnya",
    type: TransactionType.EXPENSE,
    color: "#a8a29e",
    icon: "📦",
  },
  { name: "Gaji", type: TransactionType.INCOME, color: "#22c55e", icon: "💰" },
  { name: "Bonus", type: TransactionType.INCOME, color: "#84cc16", icon: "🎁" },
  {
    name: "Lainnya",
    type: TransactionType.INCOME,
    color: "#a8a29e",
    icon: "✨",
  },
];
