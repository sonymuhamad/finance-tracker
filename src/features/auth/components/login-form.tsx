"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type DevLoginState,
  signInWithDevLogin,
  signInWithGoogle,
} from "../actions";

function GoogleSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="lg"
      className="w-full gap-2"
      disabled={pending}
    >
      {/* Google "G" mark */}
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
        />
      </svg>
      {pending ? "Menghubungkan…" : "Lanjut dengan Google"}
    </Button>
  );
}

function DevSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Masuk…" : "Masuk (dev)"}
    </Button>
  );
}

export function LoginForm({ devLoginEnabled }: { devLoginEnabled: boolean }) {
  const [state, formAction] = useActionState<DevLoginState, FormData>(
    signInWithDevLogin,
    {},
  );

  return (
    <div className="flex flex-col gap-5">
      <form action={signInWithGoogle}>
        <GoogleSubmit />
      </form>

      {devLoginEnabled ? (
        <>
          <div className="flex items-center gap-3 text-muted-foreground text-xs">
            <span className="h-px flex-1 bg-border" />
            atau masuk cepat (dev)
            <span className="h-px flex-1 bg-border" />
          </div>

          <form action={formAction} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="kamu@contoh.com"
                required
              />
              {state.error ? (
                <p className="text-destructive text-sm">{state.error}</p>
              ) : null}
            </div>
            <DevSubmit />
          </form>
        </>
      ) : null}
    </div>
  );
}
