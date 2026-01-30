import { isCommissioner } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { TradeForm } from "@/components/trade-form";

export const dynamic = "force-dynamic";

export default async function NewTradePage() {
  const commissioner = await isCommissioner();
  if (!commissioner) redirect("/dashboard");

  const allTeams = await db.select().from(teams).orderBy(teams.name);
  const teamsData = allTeams.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Record Trade</h1>
        <p className="text-muted-foreground">
          Enter the details of a completed trade
        </p>
      </div>

      <TradeForm teams={teamsData} />
    </div>
  );
}
