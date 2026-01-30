import { isCommissioner } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { getCurrentSeason } from "@/lib/settings";
import { TradeForm } from "@/components/trade-form";

export const dynamic = "force-dynamic";

export default async function NewTradePage() {
  const commissioner = await isCommissioner();
  if (!commissioner) redirect("/dashboard");

  const [allTeams, currentSeason] = await Promise.all([
    db.select().from(teams).orderBy(teams.name),
    getCurrentSeason(),
  ]);

  const teamsData = allTeams.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    abbreviation: t.abbreviation,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Record Trade</h1>
        <p className="text-muted-foreground">
          Select teams and choose assets to trade
        </p>
      </div>

      <TradeForm teams={teamsData} currentSeason={currentSeason} />
    </div>
  );
}
