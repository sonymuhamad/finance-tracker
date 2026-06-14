import { DEFAULT_LOCALE } from "@/lib/money";

/**
 * Pure digit/format helpers for `CurrencyInput` (extracted so they can be unit
 * tested). The display is id-ID grouped, where `.` is the **thousands** separator
 * — which is exactly why the field's typed string and its numeric `value` prop
 * need *different* digit extraction.
 */

const grouper = new Intl.NumberFormat(DEFAULT_LOCALE, {
  maximumFractionDigits: 0,
  useGrouping: true,
});

/**
 * Integer digits of the numeric `value` prop (a plain number string, where a
 * `.`/`,` is a *decimal* point — drop it and any leading zeros). e.g.
 * `"150000.5" → "150000"`, `"1130000" → "1130000"`, `"007" → "7"`.
 */
export function toDigits(value: string): string {
  const intPart = value.split(/[.,]/)[0] ?? "";
  return intPart.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

/**
 * Digits from what's typed in the field. The displayed value is id-ID grouped
 * (`.` is the *thousands* separator), so strip ALL non-digits — never split on a
 * separator, or a grouped value like `"2.222"` would collapse to `"2"`. e.g.
 * `"2.222" → "2222"`, `"Rp 1.130.000" → "1130000"`.
 */
export function typedDigits(value: string): string {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

/** id-ID dot-grouped display for a digit string (`"1000000" → "1.000.000"`). */
export function group(digits: string): string {
  return digits ? grouper.format(Number(digits)) : "";
}
