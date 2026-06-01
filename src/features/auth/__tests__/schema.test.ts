import { describe, expect, it } from "vitest";
import { devLoginSchema } from "../schema";

describe("devLoginSchema", () => {
  it("accepts and normalizes a valid email", () => {
    const result = devLoginSchema.safeParse({ email: "  Sony@Example.com " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("sony@example.com");
  });

  it("rejects an invalid email", () => {
    expect(devLoginSchema.safeParse({ email: "not-an-email" }).success).toBe(
      false,
    );
  });

  it("rejects an empty email", () => {
    expect(devLoginSchema.safeParse({ email: "" }).success).toBe(false);
  });
});
