import { db } from "@/lib/db";
import { players, contracts, teams, leagueSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { calculateSalary } from "@/lib/salary/engine";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { getPositionColor } from "@/lib/position-colors";

export const dynamic = "force-dynamic";

interface PlayerWithSalary {
  playerId: number;
  playerName: string;
  position: string | null;
  salary: number;
  teamName: string;
  teamSlug: string;
  yearAcquired: number;
  salaryYear: number;
}

async function getLeagueYear(): Promise<number> {
  const setting = await db
    .select()
    .from(leagueSettings)
    .where(eq(leagueSettings.key, "current_year"))
    .limit(1);

  return setting[0] ? parseInt(setting[0].value) : 2026;
}

async function getPlayersByPosition(leagueYear: number): Promise<Record<string, PlayerWithSalary[]>> {
  const results = await db
    .select({
      playerId: players.id,
      playerName: players.name,
      position: players.position,
      salary2025: contracts.salary2025,
      yearAcquired: contracts.yearAcquired,
      salaryYear: contracts.salaryYear,
      teamName: teams.name,
      teamSlug: teams.slug,
    })
    .from(contracts)
    .innerJoin(players, eq(contracts.playerId, players.id))
    .innerJoin(teams, eq(contracts.teamId, teams.id))
    .where(eq(contracts.isActive, true));

  // Calculate current year salary and group by position
  const playersByPosition: Record<string, PlayerWithSalary[]> = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
  };

  for (const r of results) {
    if (!r.position) continue;

    const salary = calculateSalary(
      Number(r.salary2025),
      r.yearAcquired,
      leagueYear,
      0.15,
      r.salaryYear
    );

    playersByPosition[r.position]?.push({
      playerId: r.playerId,
      playerName: r.playerName,
      position: r.position,
      salary,
      teamName: r.teamName,
      teamSlug: r.teamSlug,
      yearAcquired: r.yearAcquired,
      salaryYear: r.salaryYear,
    });
  }

  // Sort each position by salary descending and take top 30
  for (const pos of Object.keys(playersByPosition)) {
    playersByPosition[pos] = playersByPosition[pos]
      .sort((a, b) => b.salary - a.salary)
      .slice(0, 30);
  }

  return playersByPosition;
}

export default async function SalaryRankingsPage() {
  const leagueYear = await getLeagueYear();
  const playersByPosition = await getPlayersByPosition(leagueYear);

  const positions = ["QB", "RB", "WR", "TE"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Salary Rankings</h1>
        <p className="text-muted-foreground">
          Top 30 highest paid players by position for {leagueYear}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {positions.map((position) => {
          const positionPlayers = playersByPosition[position] || [];
          const positionColors = getPositionColor(position);

          return (
            <Card key={position}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${positionColors.badge}`}>
                    {position}
                  </span>
                  <span className="text-lg">Top 30</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead>Manager</TableHead>
                        <TableHead className="text-right">Salary</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {positionPlayers.map((player, index) => (
                        <TableRow key={player.playerId} className="text-sm">
                          <TableCell className="font-mono text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            {player.playerName}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/teams/${player.teamSlug}`}
                              className="text-muted-foreground hover:text-foreground hover:underline"
                            >
                              {player.teamName}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${player.salary}
                          </TableCell>
                        </TableRow>
                      ))}
                      {positionPlayers.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="py-4 text-center text-muted-foreground"
                          >
                            No players found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
