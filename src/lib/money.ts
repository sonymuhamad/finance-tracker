/**
 * Money helpers.
 *
 * Amounts are stored in the database as fixed-precision decimals and handled in
 * app code as plain numbers in the *major* unit (e.g. 15000 = Rp15.000).
 * Never use floats for arithmetic you display as a total — round at the edges.
 */

export const DEFAULT_CURRENCY = "IDR";
export const DEFAULT_LOCALE = "id-ID";

/** Round a major-unit amount to 2 decimal places (the money rounding policy). */
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Format a numeric amount as a localized currency string. */
export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  return (
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      // IDR conventionally shows no decimals.
      maximumFractionDigits: currency === "IDR" ? 0 : 2,
    })
      .format(amount)
      // ICU emits a non-breaking / narrow-no-break space between the symbol and
      // the digits, and its codepoint differs across ICU versions (Node vs the
      // browser) — which causes React hydration mismatches. Normalize to a plain
      // space so server and client render byte-identical strings.
      .replace(/[\u00A0\u202F]/g, " ")
  );
}

/**
 * Parse a user-typed amount string into a number.
 * Accepts grouping separators and a leading currency symbol; returns null on
 * anything that isn't a non-negative finite number.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "");
  const normalized = cleaned.replace(/,/g, ".");
  if (!/^-?\d*\.?\d+$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return roundMoney(value);
}
