"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { id } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * A styled date picker (polish backlog #1) — a calendar in a Radix Popover that
 * replaces the native `<input type="date">` (whose OS popup clashes with the
 * warm theme). Reads/writes the same `"YYYY-MM-DD"` string the forms already
 * submit, parsed as a *local* calendar date so no timezone shift moves the day.
 */

// Week starts Monday (id convention); headers align with weekStartsOn: 1.
const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/** Parse a "YYYY-MM-DD" string to a local Date (no timezone shift). */
function parseValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Format a local Date back to a "YYYY-MM-DD" string. */
function toValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

type DatePickerProps = {
  id?: string;
  /** Selected date as "YYYY-MM-DD", or "" when unset. */
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function DatePicker({
  id: htmlId,
  value,
  onValueChange,
  placeholder = "Pilih tanggal",
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseValue(value);
  const [month, setMonth] = useState(() =>
    startOfMonth(selected ?? new Date()),
  );

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const today = new Date();

  function pick(day: Date) {
    onValueChange(toValue(day));
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // Re-anchor on the selected month each time it opens.
        if (o) setMonth(startOfMonth(selected ?? new Date()));
      }}
    >
      <PopoverTrigger
        id={htmlId}
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          !selected && "text-muted-foreground",
          className,
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        {selected
          ? format(selected, "d MMM yyyy", { locale: id })
          : placeholder}
      </PopoverTrigger>
      <PopoverContent align="start">
        <div className="flex items-center justify-between px-1 pb-2">
          <button
            type="button"
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="font-heading font-medium text-sm">
            {format(month, "MMMM yyyy", { locale: id })}
          </span>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {WEEKDAYS.map((d) => (
            <span key={d} className="py-1 text-[11px] text-muted-foreground">
              {d}
            </span>
          ))}
          {days.map((day) => {
            const isSelected = selected ? isSameDay(day, selected) : false;
            const isToday = isSameDay(day, today);
            const outside = !isSameMonth(day, month);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => pick(day)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors hover:bg-secondary",
                  outside && "text-muted-foreground/50",
                  isToday && !isSelected && "font-medium text-primary",
                  isSelected &&
                    "bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
