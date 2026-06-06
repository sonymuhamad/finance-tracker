import { MovementType } from "@/generated/prisma/enums";

export type DefaultCategory = {
  name: string;
  type: MovementType;
  color: string;
  icon: string;
};

// Seeded once for a new user. Warm palette + friendly emoji.
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    name: "Makan",
    type: MovementType.EXPENSE,
    color: "#f97362",
    icon: "🍜",
  },
  {
    name: "Transport",
    type: MovementType.EXPENSE,
    color: "#f59e0b",
    icon: "🚗",
  },
  {
    name: "Belanja",
    type: MovementType.EXPENSE,
    color: "#ec4899",
    icon: "🛍️",
  },
  {
    name: "Tagihan",
    type: MovementType.EXPENSE,
    color: "#8b5cf6",
    icon: "🧾",
  },
  {
    name: "Hiburan",
    type: MovementType.EXPENSE,
    color: "#14b8a6",
    icon: "🎬",
  },
  {
    name: "Kesehatan",
    type: MovementType.EXPENSE,
    color: "#10b981",
    icon: "💊",
  },
  {
    name: "Lainnya",
    type: MovementType.EXPENSE,
    color: "#a8a29e",
    icon: "📦",
  },
  { name: "Gaji", type: MovementType.INCOME, color: "#22c55e", icon: "💰" },
  { name: "Bonus", type: MovementType.INCOME, color: "#84cc16", icon: "🎁" },
  {
    name: "Lainnya",
    type: MovementType.INCOME,
    color: "#a8a29e",
    icon: "✨",
  },
];
