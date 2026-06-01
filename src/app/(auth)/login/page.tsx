import { Wallet } from "lucide-react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentUser } from "@/features/auth/service";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const devLoginEnabled = process.env.DEV_LOGIN_ENABLED === "true";

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-sm">
            <Wallet className="size-7" />
          </span>
          <div>
            <h1 className="font-heading text-2xl">finance-tracker</h1>
            <p className="mt-1 text-balance text-muted-foreground text-sm">
              Catat keuanganmu dengan cepat — tanpa ribet spreadsheet.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border bg-card p-6 shadow-sm">
          <LoginForm devLoginEnabled={devLoginEnabled} />
        </div>

        <p className="mt-6 text-center text-muted-foreground text-xs">
          Dengan masuk, kamu setuju mencatat keuangan secara rutin 🙂
        </p>
      </div>
    </main>
  );
}
