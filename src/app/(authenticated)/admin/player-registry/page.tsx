import { isCommissioner } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { players, contracts, teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPositionColor } from "@/lib/position-colors";
import { AddMasterPlayer } from "@/components/add-master-player";
import { BulkImportPlayers } from "@/components/bulk-import-players";
import { PlayerRegistryTable } from "@/components/player-registry-table";
import { getCurrentSeason } from "@/lib/settings";

export const dynamic = "force-dynamic";

async function getAllMasterPlayers() {
  // Get all active players, ordered alphabetically by name
  const allPlayers = await db
    .select({
      id: players.id,
      name: players.name,
      position: players.position,
      yearAcquired: players.yearAcquired,
      isActive: players.isActive,
    })
    .from(players)
    .where(eq(players.isActive, true))
    .orderBy(players.name);

  // Get current team assignments and salary info for each rostered player
  const activeContracts = await db
    .select({
      playerId: contracts.playerId,
      contractId: contracts.id,
      teamName: teams.name,
      salary2025: contracts.salary2025,
      salaryYear: contracts.salaryYear,
    })
    .from(contracts)
    .innerJoin(teams, eq(contracts.teamId, teams.id))
    .where(eq(contracts.isActive, true));

  const contractMap = new Map(
    activeContracts.map((c) => [
      c.playerId,
      {
        teamName: c.teamName,
        contractId: c.contractId,
        salary: Number(c.salary2025),
        salaryYear: c.salaryYear,
      },
    ])
  );

  return allPlayers.map((p) => {
    const contractInfo = contractMap.get(p.id);
    return {
      ...p,
      currentTeam: contractInfo?.teamName || null,
      contractId: contractInfo?.contractId || null,
      salary: contractInfo?.salary || null,
      salaryYear: contractInfo?.salaryYear || null,
    };
  });
}

export default async function PlayerRegistryPage() {
  const commissioner = await isCommissioner();
  if (!commissioner) redirect("/dashboard");

  const masterPlayers = await getAllMasterPlayers();
  const currentSeason = await getCurrentSeason();

  // Group players by position for summary
  const byPosition = {
    QB: masterPlayers.filter((p) => p.position === "QB"),
    RB: masterPlayers.filter((p) => p.position === "RB"),
    WR: masterPlayers.filter((p) => p.position === "WR"),
    TE: masterPlayers.filter((p) => p.position === "TE"),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Master Player Registry
        </h1>
        <p className="text-muted-foreground">
          The master list of all players and their year acquired. Add players one at a time,
          bulk import new rookies each year, edit years when players change teams,
          or delete retired players.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["QB", "RB", "WR", "TE"] as const).map((pos) => {
          const colors = getPositionColor(pos);
          const posPlayers = byPosition[pos];
          const rostered = posPlayers.filter((p) => p.currentTeam).length;
          return (
            <Card key={pos} className={`${colors.border}`}>
              <CardHeader className="pb-2">
                <CardTitle className={colors.text}>{pos}</CardTitle>
                <CardDescription>
                  {posPlayers.length} total, {rostered} rostered
                </CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <AddMasterPlayer />
        <BulkImportPlayers />
      </div>

      {/* Player table with search */}
      <Card>
        <CardHeader>
          <CardTitle>All Players ({masterPlayers.length})</CardTitle>
          <CardDescription>
            Players are listed alphabetically. Use the search to quickly find and edit players.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlayerRegistryTable players={masterPlayers} currentSeason={currentSeason} />
        </CardContent>
      </Card>
    </div>
  );
}
