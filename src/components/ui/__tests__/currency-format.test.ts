import { describe, expect, it } from "vitest";
import { group, toDigits, typedDigits } from "../currency-format";

describe("typedDigits (from the grouped field string)", () => {
  it("keeps every digit of a grouped value — the . is a thousands separator", () => {
    // Regression: splitting on "." collapsed "2.222" → "2" and capped input ~5 digits.
    expect(typedDigits("2.222")).toBe("2222");
    expect(typedDigits("Rp 1.130.000")).toBe("1130000");
    expect(typedDigits("12.345.678")).toBe("12345678");
  });

  it("strips leading zeros but keeps a lone zero, and handles empty", () => {
    expect(typedDigits("007")).toBe("7");
    expect(typedDigits("0")).toBe("0");
    expect(typedDigits("")).toBe("");
  });
});

describe("toDigits (from the numeric value prop)", () => {
  it("drops a decimal part (here . / , is a decimal point, not grouping)", () => {
    expect(toDigits("150000.5")).toBe("150000");
    expect(toDigits("1130000")).toBe("1130000");
    expect(toDigits("0")).toBe("0");
    expect(toDigits("")).toBe("");
  });
});

describe("group", () => {
  it("formats a digit string with id-ID dot grouping", () => {
    expect(group("1000000")).toBe("1.000.000");
    expect(group("2222")).toBe("2.222");
    expect(group("")).toBe("");
  });
});
