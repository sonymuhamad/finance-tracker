import { requireUser } from "@/features/auth/service";

// Placeholder home. The real "X → Y → Z safe-to-spend" home + cycle switcher is
// built in RFC 0009 (PRD 008) on top of the movement + cycle foundation (0005).
export default async function HomePage() {
  const user = await requireUser();
  const firstName = (user.name ?? user.email ?? "kamu").split(/[\s@]/)[0];

  return (
    <div className="space-y-5 py-6">
      <h1 className="text-2xl">
        Hai, {firstName} <span className="align-middle">👋</span>
      </h1>

      <div className="rounded-3xl border bg-card p-10 text-center">
        <p className="text-4xl">🚧</p>
        <p className="mt-3 font-medium">Beranda lagi dibangun</p>
        <p className="mt-1 text-muted-foreground text-sm">
          Pondasi cash-flow (dompet, pemasukan, pengeluaran, siklus gajian) lagi
          dikerjain. Sebentar lagi “aman dipakai sampai gajian” muncul di sini.
        </p>
      </div>
    </div>
  );
}
