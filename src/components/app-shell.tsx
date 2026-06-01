"use client";

import { LayoutGrid, LogOut, Tags, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

type ShellUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

const NAV = [
  { href: "/", label: "Beranda", icon: LayoutGrid },
  { href: "/transactions", label: "Transaksi", icon: Wallet },
  { href: "/categories", label: "Kategori", icon: Tags },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const initial = (user.name ?? user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Wallet className="size-5" />
          </span>
          <span className="font-heading text-lg">finance-tracker</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex size-9 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground"
            aria-label="Menu akun"
          >
            {initial}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground text-xs">
              {user.email ?? user.name}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => {
                void signOutAction();
              }}
            >
              <LogOut className="size-4" />
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="flex-1 px-5 pb-28">{children}</main>

      {/* Phone-first bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-2xl">
        <div className="m-3 flex items-center justify-around rounded-3xl border bg-card/90 p-1.5 shadow-lg backdrop-blur">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-xs transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
