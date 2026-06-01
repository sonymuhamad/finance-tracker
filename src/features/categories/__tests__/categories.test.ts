import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "../defaults";
import { createCategorySchema } from "../schema";

describe("createCategorySchema", () => {
  it("accepts a valid category", () => {
    const r = createCategorySchema.safeParse({
      name: "Makan",
      type: "EXPENSE",
      color: "#f97362",
      icon: "🍜",
    });
    expect(r.success).toBe(true);
  });

  it("trims the name and allows missing color/icon", () => {
    const r = createCategorySchema.safeParse({
      name: "  Gaji  ",
      type: "INCOME",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("Gaji");
  });

  it("rejects an empty name", () => {
    expect(
      createCategorySchema.safeParse({ name: "", type: "EXPENSE" }).success,
    ).toBe(false);
  });

  it("rejects an invalid color", () => {
    expect(
      createCategorySchema.safeParse({
        name: "X",
        type: "EXPENSE",
        color: "red",
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid type", () => {
    expect(
      createCategorySchema.safeParse({ name: "X", type: "FOO" }).success,
    ).toBe(false);
  });
});

describe("DEFAULT_CATEGORIES", () => {
  it("has unique name per type and complete metadata", () => {
    const seen = new Set<string>();
    for (const c of DEFAULT_CATEGORIES) {
      const key = `${c.type}:${c.name}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.icon.length).toBeGreaterThan(0);
    }
  });
});
