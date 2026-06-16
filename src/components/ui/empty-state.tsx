import { Plus } from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";

/**
 * Friendly empty state: icon + message + an optional inline add action. Keeps an
 * empty section from rendering as a bare "Belum ada…" line (the managers felt
 * hollow before). Shared across the expenses/income/wallets/categories pages.
 */
export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed bg-card px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
        <Icon className="size-6" />
      </span>
      <p className="font-medium">{title}</p>
      <p className="max-w-xs text-muted-foreground text-sm">{subtitle}</p>
      {action && (
        <Button
          onClick={action.onClick}
          variant="secondary"
          size="sm"
          className="mt-1 gap-1.5"
        >
          <Plus className="size-4" /> {action.label}
        </Button>
      )}
    </div>
  );
}
