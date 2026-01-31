import { db } from "@/lib/db";
import { teams, contracts, players, leagueSettings, draftPicks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateSalary, calculateCapHit } from "@/lib/salary/engine";
import { getDraftPickCapValue } from "@/lib/salary/rookie-scale";
import { CAP_BY_YEAR, type AcquisitionType } from "@/lib/constants";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getPositionColor } from "@/lib/position-colors";

export const dynamic = "force-dynamic";

interface PlayerData {
  id: number;
  name: string;
  position: string | null;
  salary: number;
  capHit: number;
  rosterStatus: string;
}

interface DraftPickData {
  id: number;
  round: number;
  originalTeamAbbr: string;
  salary: number;
}

interface TeamRoster {
  id: number;
  name: string;
  slug: string;
  abbreviation: string;
  totalSalary: number;
  capSpace: number;
  salaryCap: number;
  players: {
    QB: PlayerData[];
    RB: PlayerData[];
    WR: PlayerData[];
    TE: PlayerData[];
  };
  draftPicks: DraftPickData[];
}

async function getLeagueYear(): Promise<number> {
  const setting = await db
    .select()
    .from(leagueSettings)
    .where(eq(leagueSettings.key, "current_year"))
    .limit(1);

  return setting[0] ? parseInt(setting[0].value) : 2026;
}

async function getAllTeamsWithRosters(leagueYear: number): Promise<TeamRoster[]> {
  const allTeams = await db.select().from(teams).orderBy(teams.name);
  const cap = CAP_BY_YEAR[leagueYear] ?? 275;

  // Create a map of team IDs to abbreviations for draft pick display
  const teamAbbrMap = new Map(allTeams.map(t => [t.id, t.abbreviation]));

  const teamsWithRosters = await Promise.all(
    allTeams.map(async (team) => {
      const teamContracts = await db
        .select({
          playerId: players.id,
          playerName: players.name,
          position: players.position,
          salary2025: contracts.salary2025,
          yearAcquired: contracts.yearAcquired,
          salaryYear: contracts.salaryYear,
          acquisitionType: contracts.acquisitionType,
          rosterStatus: contracts.rosterStatus,
        })
        .from(contracts)
        .innerJoin(players, eq(contracts.playerId, players.id))
        .where(
          and(eq(contracts.teamId, team.id), eq(contracts.isActive, true))
        );

      // Get current year draft picks owned by this team
      const teamDraftPicks = await db
        .select({
          id: draftPicks.id,
          round: draftPicks.round,
          originalTeamId: draftPicks.originalTeamId,
          salaryOverride: draftPicks.salaryOverride,
        })
        .from(draftPicks)
        .where(
          and(
            eq(draftPicks.currentTeamId, team.id),
            eq(draftPicks.year, leagueYear),
            eq(draftPicks.isUsed, false)
          )
        )
        .orderBy(draftPicks.round);

      const playersByPosition: TeamRoster["players"] = {
        QB: [],
        RB: [],
        WR: [],
        TE: [],
      };

      let totalSalary = 0;

      for (const c of teamContracts) {
        const salary = calculateSalary(
          Number(c.salary2025),
          c.yearAcquired,
          leagueYear,
          0.15,
          c.salaryYear,
          c.acquisitionType as AcquisitionType
        );
        const capHit = calculateCapHit(salary, c.rosterStatus);
        totalSalary += capHit;

        const playerData: PlayerData = {
          id: c.playerId,
          name: c.playerName,
          position: c.position,
          salary,
          capHit,
          rosterStatus: c.rosterStatus,
        };

        if (c.position && playersByPosition[c.position as keyof typeof playersByPosition]) {
          playersByPosition[c.position as keyof typeof playersByPosition].push(playerData);
        }
      }

      // Sort each position group by salary descending
      for (const pos of Object.keys(playersByPosition) as Array<keyof typeof playersByPosition>) {
        playersByPosition[pos].sort((a, b) => b.salary - a.salary);
      }

      // Format draft picks with salary values
      const formattedPicks: DraftPickData[] = teamDraftPicks.map(pick => ({
        id: pick.id,
        round: pick.round,
        originalTeamAbbr: teamAbbrMap.get(pick.originalTeamId) || "???",
        salary: pick.salaryOverride ?? getDraftPickCapValue(pick.round),
      }));

      return {
        id: team.id,
        name: team.name,
        slug: team.slug,
        abbreviation: team.abbreviation,
        totalSalary,
        capSpace: cap - totalSalary,
        salaryCap: cap,
        players: playersByPosition,
        draftPicks: formattedPicks,
      };
    })
  );

  return teamsWithRosters;
}

export default async function DashboardPage() {
  const leagueYear = await getLeagueYear();
  const teamsWithRosters = await getAllTeamsWithRosters(leagueYear);
  const positions = ["QB", "RB", "WR", "TE"] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">League Of Jesters</h1>
        <p className="text-muted-foreground">
          {leagueYear} Season Rosters
        </p>
      </div>

      {/* Horizontal scrollable container for all teams */}
      <div className="overflow-x-auto pb-4">
        <div className="inline-flex gap-4" style={{ minWidth: "max-content" }}>
          {teamsWithRosters.map((team) => (
            <div
              key={team.id}
              className="w-56 flex-shrink-0 rounded-lg border bg-card"
            >
              {/* Team Header */}
              <Link href={`/teams/${team.slug}`}>
                <div className="border-b p-3 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm truncate">{team.name}</span>
                    <Badge
                      variant={team.capSpace >= 0 ? "default" : "destructive"}
                      className={`text-xs ${team.capSpace >= 0 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : ""}`}
                    >
                      ${team.capSpace >= 0 ? team.capSpace : Math.abs(team.capSpace)}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    ${team.totalSalary} / ${team.salaryCap}
                  </div>
                </div>
              </Link>

              {/* Players by Position */}
              <div className="p-2 space-y-3">
                {positions.map((position) => {
                  const posPlayers = team.players[position];
                  const posColors = getPositionColor(position);

                  return (
                    <div key={position}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ${posColors.badge}`}>
                          {position}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({posPlayers.length})
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {posPlayers.length > 0 ? (
                          posPlayers.map((player) => (
                            <div
                              key={player.id}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className={`truncate pr-2 ${
                                player.rosterStatus === "active"
                                  ? "text-gray-900 dark:text-gray-100 font-medium"
                                  : "text-gray-400 dark:text-gray-500"
                              }`}>
                                {player.name}
                                {player.rosterStatus === "practice_squad" && (
                                  <span className="ml-1 text-gray-400 dark:text-gray-500">(PS)</span>
                                )}
                                {player.rosterStatus === "injured_reserve" && (
                                  <span className="ml-1 text-red-400 dark:text-red-500">(IR)</span>
                                )}
                              </span>
                              <span className={`font-mono flex-shrink-0 ${
                                player.rosterStatus === "active"
                                  ? "text-gray-800 dark:text-gray-200"
                                  : "text-gray-400 dark:text-gray-500"
                              }`}>
                                ${player.salary}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-muted-foreground italic">
                            None
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Draft Picks Section */}
                {team.draftPicks.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        Picks
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({team.draftPicks.length})
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {team.draftPicks.map((pick) => (
                        <div
                          key={pick.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span>
                            R{pick.round}
                            {pick.originalTeamAbbr !== team.abbreviation && (
                              <span className="ml-1 text-muted-foreground">
                                ({pick.originalTeamAbbr})
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-muted-foreground flex-shrink-0">
                            ${pick.salary}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
