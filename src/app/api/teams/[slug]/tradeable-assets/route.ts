import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, contracts, players, draftPicks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// GET - Get all tradeable assets for a team (players on roster + owned draft picks)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Get team by slug
  const team = await db
    .select()
    .from(teams)
    .where(eq(teams.slug, slug))
    .limit(1);

  if (team.length === 0) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const teamId = team[0].id;

  // Get all active contracts (players) for this team
  const teamPlayers = await db
    .select({
      contractId: contracts.id,
      playerId: players.id,
      playerName: players.name,
      position: players.position,
      nflTeam: players.nflTeam,
      salary: contracts.salary2025,
    })
    .from(contracts)
    .innerJoin(players, eq(contracts.playerId, players.id))
    .where(and(eq(contracts.teamId, teamId), eq(contracts.isActive, true)));

  // Get all unused draft picks owned by this team
  const teamPicks = await db
    .select({
      pickId: draftPicks.id,
      year: draftPicks.year,
      round: draftPicks.round,
      pickNumber: draftPicks.pickNumber,
      originalTeamId: draftPicks.originalTeamId,
      originalTeamAbbr: teams.abbreviation,
    })
    .from(draftPicks)
    .innerJoin(teams, eq(draftPicks.originalTeamId, teams.id))
    .where(and(eq(draftPicks.currentTeamId, teamId), eq(draftPicks.isUsed, false)));

  return NextResponse.json({
    teamId,
    teamName: team[0].name,
    players: teamPlayers.map((p) => ({
      type: "player" as const,
      id: p.playerId,
      contractId: p.contractId,
      name: p.playerName,
      position: p.position,
      nflTeam: p.nflTeam,
      salary: p.salary,
      label: `${p.playerName} (${p.position}) - $${Number(p.salary).toFixed(0)}`,
    })),
    picks: teamPicks.map((p) => ({
      type: "draft_pick" as const,
      id: p.pickId,
      year: p.year,
      round: p.round,
      pickNumber: p.pickNumber,
      originalTeamAbbr: p.originalTeamAbbr,
      label: `${p.year} Round ${p.round}${p.originalTeamId !== teamId ? ` (${p.originalTeamAbbr}'s pick)` : ""}`,
    })),
  });
}
