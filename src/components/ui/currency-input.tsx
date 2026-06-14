"use client";

import type * as React from "react";
import { useLayoutEffect, useRef } from "react";
import { group, toDigits, typedDigits } from "@/components/ui/currency-format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A reusable Rupiah amount input (polish backlog #2).
 *
 * Shows a `Rp` prefix and live id-ID thousand-grouping as you type
 * (`1000000` → `Rp 1.000.000`, consistent with `formatCurrency`), but stores and
 * emits the raw digit string — so callers submit plain digits, never the grouped
 * display. Integer-only (IDR shows no decimals); `inputMode="numeric"` and no
 * spinner. Pure digit/format helpers live in `./currency-format` (tested there).
 */

type CurrencyInputProps = {
  /** The raw amount as a digit string (e.g. "1000000"); "" when empty. */
  value: string;
  /** Receives the raw digit string on every edit. */
  onValueChange: (rawDigits: string) => void;
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "ref">;

export function CurrencyInput({
  value,
  onValueChange,
  className,
  ...props
}: CurrencyInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  // Digits to the left of the caret, captured on the last edit so the caret can
  // be restored after re-grouping shifts the string (e.g. inserting a dot).
  const caretDigits = useRef<number | null>(null);

  const display = group(toDigits(value));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || caretDigits.current === null) return;
    const target = caretDigits.current;
    caretDigits.current = null;
    let pos = 0;
    if (target > 0) {
      pos = el.value.length;
      let seen = 0;
      for (let i = 0; i < el.value.length; i++) {
        if (/\d/.test(el.value[i] as string)) {
          seen += 1;
          if (seen === target) {
            pos = i + 1;
            break;
          }
        }
      }
    }
    el.setSelectionRange(pos, pos);
  });

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const caret = el.selectionStart ?? el.value.length;
    caretDigits.current = el.value.slice(0, caret).replace(/\D/g, "").length;
    onValueChange(typedDigits(el.value));
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground text-sm">
        Rp
      </span>
      <Input
        ref={ref}
        inputMode="numeric"
        autoComplete="off"
        className={cn("pl-8 tabular-nums", className)}
        value={display}
        onChange={onChange}
        {...props}
      />
    </div>
  );
}
