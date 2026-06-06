import type { MovementType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { DefaultCategory } from "./defaults";

type CategoryData = {
  name: string;
  type: MovementType;
  color?: string;
  icon?: string;
};

export function listByUser(userId: string) {
  return prisma.category.findMany({
    where: { userId },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export function countByUser(userId: string) {
  return prisma.category.count({ where: { userId } });
}

export function create(userId: string, data: CategoryData) {
  return prisma.category.create({ data: { userId, ...data } });
}

/** Scoped by userId so a user can only touch their own rows. */
export function update(id: string, userId: string, data: CategoryData) {
  return prisma.category.updateMany({ where: { id, userId }, data });
}

export function remove(id: string, userId: string) {
  return prisma.category.deleteMany({ where: { id, userId } });
}

export function createManyDefaults(
  userId: string,
  defaults: DefaultCategory[],
) {
  return prisma.category.createMany({
    data: defaults.map((d) => ({ userId, ...d })),
  });
}
