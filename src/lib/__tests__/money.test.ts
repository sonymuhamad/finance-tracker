import { describe, expect, it } from "vitest";
import { formatCurrency, parseAmount } from "@/lib/money";

// Intl uses a non-breaking space (U+00A0) as the currency separator; normalize
// it to a regular space so the assertions stay readable.
const normalizeSpaces = (s: string) => s.replace(/\u00a0/g, " ");

describe("formatCurrency", () => {
  it("formats IDR with no decimals", () => {
    expect(normalizeSpaces(formatCurrency(15000))).toBe("Rp 15.000");
  });

  it("formats USD with two decimals", () => {
    expect(formatCurrency(1234.5, "USD", "en-US")).toBe("$1,234.50");
  });
});

describe("parseAmount", () => {
  it("parses a plain number", () => {
    expect(parseAmount("15000")).toBe(15000);
  });

  it("strips currency symbols and grouping separators", () => {
    expect(parseAmount("Rp15.000")).toBe(15000);
  });

  it("rejects negative and non-numeric input", () => {
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});
