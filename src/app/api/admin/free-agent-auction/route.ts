import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  players,
  contracts,
  teams,
  freeAgentAuctionHistory,
  leagueSettings,
} from "@/lib/db/schema";
import { eq, isNull, notInArray, desc, sql, and } from "drizzle-orm";
import { isCommissioner } from "@/lib/auth/server";
import { revalidatePath } from "next/cache";

// GET - Get free agents (players not on any active roster)
export async function GET() {
  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get IDs of players who have active contracts
  const playersWithContracts = await db
    .select({ playerId: contracts.playerId })
    .from(contracts)
    .where(eq(contracts.isActive, true));

  const playerIdsWithContracts = playersWithContracts.map((p) => p.playerId);

  // Get all active players NOT in active contracts
  let freeAgents;
  if (playerIdsWithContracts.length > 0) {
    freeAgents = await db
      .select({
        id: players.id,
        name: players.name,
        position: players.position,
        nflTeam: players.nflTeam,
      })
      .from(players)
      .where(
        and(
          eq(players.isActive, true),
          notInArray(players.id, playerIdsWithContracts)
        )
      )
      .orderBy(players.name);
  } else {
    freeAgents = await db
      .select({
        id: players.id,
        name: players.name,
        position: players.position,
        nflTeam: players.nflTeam,
      })
      .from(players)
      .where(eq(players.isActive, true))
      .orderBy(players.name);
  }

  // Get all teams
  const allTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
      abbreviation: teams.abbreviation,
    })
    .from(teams)
    .orderBy(teams.name);

  // Get current season
  const seasonSetting = await db
    .select({ value: leagueSettings.value })
    .from(leagueSettings)
    .where(eq(leagueSettings.key, "current_season"))
    .limit(1);
  const currentSeason = seasonSetting[0]?.value
    ? parseInt(seasonSetting[0].value, 10)
    : new Date().getFullYear();

  // Get current auction picks for this year
  const currentAuctionPicks = await db
    .select({
      id: freeAgentAuctionHistory.id,
      pickOrder: freeAgentAuctionHistory.pickOrder,
      playerId: freeAgentAuctionHistory.playerId,
      playerName: freeAgentAuctionHistory.playerName,
      position: freeAgentAuctionHistory.position,
      salary: freeAgentAuctionHistory.salary,
      teamId: freeAgentAuctionHistory.teamId,
      teamName: teams.name,
      teamAbbr: teams.abbreviation,
      createdAt: freeAgentAuctionHistory.createdAt,
    })
    .from(freeAgentAuctionHistory)
    .innerJoin(teams, eq(freeAgentAuctionHistory.teamId, teams.id))
    .where(eq(freeAgentAuctionHistory.year, currentSeason))
    .orderBy(desc(freeAgentAuctionHistory.pickOrder));

  // Get next pick order
  const maxPick = currentAuctionPicks.length > 0
    ? Math.max(...currentAuctionPicks.map(p => p.pickOrder))
    : 0;

  return NextResponse.json({
    freeAgents,
    teams: allTeams,
    currentSeason,
    currentAuctionPicks,
    nextPickOrder: maxPick + 1,
  });
}

// POST - Draft a free agent
export async function POST(request: Request) {
  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { playerId, teamId, salary, position } = body;

  if (!playerId || !teamId || salary === undefined) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Get player info
  const player = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (player.length === 0) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Get current season
  const seasonSetting = await db
    .select({ value: leagueSettings.value })
    .from(leagueSettings)
    .where(eq(leagueSettings.key, "current_season"))
    .limit(1);
  const currentSeason = seasonSetting[0]?.value
    ? parseInt(seasonSetting[0].value, 10)
    : new Date().getFullYear();

  // Check if player already has active contract
  const existingContract = await db
    .select()
    .from(contracts)
    .where(and(eq(contracts.playerId, playerId), eq(contracts.isActive, true)))
    .limit(1);

  if (existingContract.length > 0) {
    return NextResponse.json(
      { error: "Player already has an active contract" },
      { status: 400 }
    );
  }

  // Determine position - use provided or existing
  const finalPosition = position || player[0].position;

  // Update player position if provided and different
  if (position && position !== player[0].position) {
    await db
      .update(players)
      .set({ position, updatedAt: new Date() })
      .where(eq(players.id, playerId));
  }

  // Get next pick order
  const maxPickResult = await db
    .select({ maxPick: sql<number>`MAX(${freeAgentAuctionHistory.pickOrder})` })
    .from(freeAgentAuctionHistory)
    .where(eq(freeAgentAuctionHistory.year, currentSeason));
  const nextPickOrder = (maxPickResult[0]?.maxPick || 0) + 1;

  // Create contract for the player
  await db.insert(contracts).values({
    playerId,
    teamId,
    salary2025: salary.toString(),
    salaryYear: currentSeason,
    yearAcquired: currentSeason,
    acquisitionType: "auction",
    rosterStatus: "active",
    isActive: true,
  });

  // Add to auction history
  await db.insert(freeAgentAuctionHistory).values({
    year: currentSeason,
    pickOrder: nextPickOrder,
    playerId,
    playerName: player[0].name,
    position: finalPosition,
    teamId,
    salary: salary.toString(),
  });

  revalidatePath("/admin/free-agent-auction");
  revalidatePath("/free-agent-auction");
  revalidatePath(`/teams`);

  return NextResponse.json({ success: true, pickOrder: nextPickOrder });
}

// DELETE - Remove an auction pick (undo)
export async function DELETE(request: Request) {
  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing ID" }, { status: 400 });
  }

  // Get the auction pick to find the contract
  const auctionPick = await db
    .select()
    .from(freeAgentAuctionHistory)
    .where(eq(freeAgentAuctionHistory.id, parseInt(id, 10)))
    .limit(1);

  if (auctionPick.length === 0) {
    return NextResponse.json({ error: "Pick not found" }, { status: 404 });
  }

  // Deactivate the contract for this player/team
  await db
    .update(contracts)
    .set({ isActive: false, droppedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(contracts.playerId, auctionPick[0].playerId),
        eq(contracts.teamId, auctionPick[0].teamId),
        eq(contracts.isActive, true)
      )
    );

  // Delete the auction history entry
  await db
    .delete(freeAgentAuctionHistory)
    .where(eq(freeAgentAuctionHistory.id, parseInt(id, 10)));

  revalidatePath("/admin/free-agent-auction");
  revalidatePath("/free-agent-auction");
  revalidatePath(`/teams`);

  return NextResponse.json({ success: true });
}
