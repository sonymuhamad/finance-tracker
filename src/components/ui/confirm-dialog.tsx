"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmState = ConfirmOptions & {
  open: boolean;
  resolve?: (ok: boolean) => void;
};

/**
 * Themed replacement for the native `confirm()` — on-brand, safe-area aware, and
 * gives destructive actions a clear danger affordance. `confirm(options)` returns
 * a Promise<boolean>; render `confirmDialog` once in the component tree.
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (!(await confirm({ title: "Hapus?", destructive: true }))) return;
 *   ...
 *   return (<div>… {confirmDialog}</div>);
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: "",
  });

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, open: true, resolve });
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    setState((s) => {
      s.resolve?.(ok);
      return { ...s, open: false, resolve: undefined };
    });
  }, []);

  const confirmDialog = (
    <Dialog open={state.open} onOpenChange={(v) => !v && settle(false)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          {state.description && (
            <DialogDescription>{state.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => settle(false)}>
            {state.cancelLabel ?? "Batal"}
          </Button>
          <Button
            variant={state.destructive ? "destructive" : "default"}
            onClick={() => settle(true)}
          >
            {state.confirmLabel ?? "Lanjut"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, confirmDialog };
}
