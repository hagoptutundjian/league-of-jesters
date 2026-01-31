import { db } from "@/lib/db";
import { players, contracts, teams, leagueSettings } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { calculateSalary } from "@/lib/salary/engine";
import { PlayerRegistry } from "@/components/player-registry";

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

async function getAllTeams() {
  return db
    .select({
      slug: teams.slug,
      name: teams.name,
    })
    .from(teams)
    .orderBy(asc(teams.name));
}

async function getAllPlayers(leagueYear: number): Promise<PlayerWithSalary[]> {
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

  return results.map((r) => ({
    playerId: r.playerId,
    playerName: r.playerName,
    position: r.position,
    salary: calculateSalary(
      Number(r.salary2025),
      r.yearAcquired,
      leagueYear,
      0.15,
      r.salaryYear
    ),
    teamName: r.teamName,
    teamSlug: r.teamSlug,
    yearAcquired: r.yearAcquired,
    salaryYear: r.salaryYear,
  }));
}

export default async function PlayerRegistryPage() {
  const leagueYear = await getLeagueYear();
  const [allPlayers, allTeams] = await Promise.all([
    getAllPlayers(leagueYear),
    getAllTeams(),
  ]);

  return (
    <PlayerRegistry
      players={allPlayers}
      teams={allTeams}
      leagueYear={leagueYear}
    />
  );
}
