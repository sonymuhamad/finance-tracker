"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The compact cycle-switcher pill (RFC 0009) — a dropdown that links to the same
 * route with a different `?offset`. Shared by the home and `/expenses` so both
 * project current → future cycles identically. Past cycles are never in the
 * strip (they'd need an opening-balance reconstruction; out of MVP scope).
 */

type CycleChip = { offset: number; label: string };

export function CycleSwitcher({
  strip,
  current,
  basePath,
}: {
  strip: CycleChip[];
  current: number;
  basePath: string;
}) {
  const href = (offset: number) =>
    offset === 0 ? basePath : `${basePath}?offset=${offset}`;
  const currentLabel =
    current === 0
      ? "Sekarang"
      : (strip.find((c) => c.offset === current)?.label ?? "Sekarang");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex shrink-0 items-center gap-1 rounded-full border bg-card px-3 py-1.5 font-medium text-sm">
        {currentLabel}
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-72 w-52 overflow-y-auto"
      >
        {strip.map((c) => (
          <DropdownMenuItem key={c.offset} asChild className="cursor-pointer">
            <Link href={href(c.offset)}>
              <span className="flex-1">
                {c.offset === 0 ? "Sekarang" : c.label}
              </span>
              {c.offset > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  proyeksi
                </span>
              )}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
