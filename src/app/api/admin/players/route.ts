import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contracts, players } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser, isCommissioner } from "@/lib/auth/server";

// POST - Add a new player (commissioner only)
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Commissioner only" }, { status: 403 });
  }

  const body = await request.json();
  const { playerName, position, salary2025, salaryYear, yearAcquired, teamId, rosterStatus, acquisitionType } = body;

  if (!playerName || !position || salary2025 === undefined || !yearAcquired || !teamId) {
    return NextResponse.json(
      { error: "playerName, position, salary2025, yearAcquired, and teamId are required" },
      { status: 400 }
    );
  }

  // Check if player exists
  let playerId: number;
  const existing = await db
    .select()
    .from(players)
    .where(eq(players.name, playerName))
    .limit(1);

  if (existing.length > 0) {
    playerId = existing[0].id;
    // Update position if different
    if (existing[0].position !== position) {
      await db.update(players).set({ position }).where(eq(players.id, playerId));
    }
  } else {
    const newPlayer = await db
      .insert(players)
      .values({ name: playerName, position })
      .returning({ id: players.id });
    playerId = newPlayer[0].id;
  }

  // Create contract
  const newContract = await db
    .insert(contracts)
    .values({
      playerId,
      teamId,
      salary2025: salary2025.toString(),
      salaryYear: salaryYear || 2025,
      yearAcquired,
      acquisitionType: acquisitionType || "auction",
      rosterStatus: rosterStatus || "active",
      originalSalary2025: salary2025.toString(),
    })
    .returning({ id: contracts.id });

  return NextResponse.json({ success: true, contractId: newContract[0].id, playerId });
}

// PATCH - Update a player/contract (commissioner only)
export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Commissioner only" }, { status: 403 });
  }

  const body = await request.json();
  const { contractId, playerName, position, salary2025, yearAcquired, rosterStatus, teamId } = body;

  if (!contractId) {
    return NextResponse.json({ error: "contractId is required" }, { status: 400 });
  }

  // Get the contract to find the player
  const contract = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (contract.length === 0) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const playerId = contract[0].playerId;

  // Update player name and position if provided
  if (playerName || position) {
    const playerUpdates: Partial<{ name: string; position: "QB" | "WR" | "RB" | "TE" }> = {};
    if (playerName) playerUpdates.name = playerName;
    if (position) playerUpdates.position = position as "QB" | "WR" | "RB" | "TE";
    await db.update(players).set(playerUpdates).where(eq(players.id, playerId));
  }

  // Update contract
  const contractUpdates: Partial<{
    salary2025: string;
    yearAcquired: number;
    rosterStatus: "active" | "practice_squad" | "injured_reserve";
    teamId: number;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (salary2025 !== undefined) contractUpdates.salary2025 = salary2025.toString();
  if (yearAcquired) contractUpdates.yearAcquired = yearAcquired;
  if (rosterStatus) contractUpdates.rosterStatus = rosterStatus;
  if (teamId) contractUpdates.teamId = teamId;

  await db.update(contracts).set(contractUpdates).where(eq(contracts.id, contractId));

  return NextResponse.json({ success: true });
}

// DELETE - Remove a player/contract (commissioner only)
export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Commissioner only" }, { status: 403 });
  }

  const body = await request.json();
  const { contractId } = body;

  if (!contractId) {
    return NextResponse.json({ error: "contractId is required" }, { status: 400 });
  }

  // Soft delete - mark as inactive
  await db
    .update(contracts)
    .set({ isActive: false, droppedAt: new Date(), updatedAt: new Date() })
    .where(eq(contracts.id, contractId));

  return NextResponse.json({ success: true });
}
