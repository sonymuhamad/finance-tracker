import { requireUser } from "@/features/auth/service";
import { listCards } from "@/features/cards/service";
import { listCategories } from "@/features/categories/service";
import { HomeView } from "@/features/home/components/home-view";
import { toHomeDTO } from "@/features/home/mapper";
import { getCycleForecast } from "@/features/home/service";

// The real "X → Y → Z safe-to-spend" home + cycle switcher (RFC 0009), composing
// the movement + cycle foundation (0005) and the wallets/income/expenses features.
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const user = await requireUser();
  const { offset: offsetRaw } = await searchParams;
  const parsed = Number(offsetRaw);
  const offset = Number.isFinite(parsed)
    ? Math.max(0, Math.min(12, Math.trunc(parsed)))
    : 0;

  const [home, cards, categories] = await Promise.all([
    getCycleForecast(user.id, offset),
    listCards(user.id),
    listCategories(user.id),
  ]);

  const firstName = (user.name ?? user.email ?? "kamu").split(/[\s@]/)[0];
  const wallets = home.wallets.map(({ wallet }) => ({
    id: wallet.id,
    name: wallet.name,
    emoji: wallet.emoji,
  }));
  const cardList = cards.map((c) => ({ id: c.id, name: c.name }));
  const tags = categories.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
  }));

  return (
    <div className="py-6">
      <HomeView
        home={toHomeDTO(home)}
        firstName={firstName}
        wallets={wallets}
        cards={cardList}
        tags={tags}
      />
    </div>
  );
}
