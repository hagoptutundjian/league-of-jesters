import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { players } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser, isCommissioner } from "@/lib/auth/server";

// GET - Get all master players (for dropdown selection)
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allPlayers = await db
    .select({
      id: players.id,
      name: players.name,
      position: players.position,
      nflTeam: players.nflTeam,
      yearAcquired: players.yearAcquired,
    })
    .from(players)
    .where(eq(players.isActive, true))
    .orderBy(players.name);

  return NextResponse.json(allPlayers);
}

// POST - Add a new player to the master registry (commissioner only)
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
  const { name, position, nflTeam, yearAcquired } = body;

  if (!name || !yearAcquired) {
    return NextResponse.json(
      { error: "name and yearAcquired are required" },
      { status: 400 }
    );
  }

  // Check if player already exists (including inactive ones)
  const existing = await db
    .select()
    .from(players)
    .where(eq(players.name, name))
    .limit(1);

  if (existing.length > 0) {
    // If player exists but is inactive, reactivate them
    if (!existing[0].isActive) {
      await db
        .update(players)
        .set({
          isActive: true,
          yearAcquired,
          position: position || existing[0].position,
          updatedAt: new Date(),
        })
        .where(eq(players.id, existing[0].id));

      return NextResponse.json({
        success: true,
        playerId: existing[0].id,
        reactivated: true,
      });
    }

    return NextResponse.json(
      { error: "Player already exists in the registry" },
      { status: 400 }
    );
  }

  const newPlayer = await db
    .insert(players)
    .values({
      name,
      position: position || null,
      nflTeam: nflTeam || null,
      yearAcquired,
    })
    .returning({ id: players.id });

  return NextResponse.json({ success: true, playerId: newPlayer[0].id });
}

// PATCH - Update a player in the master registry (commissioner only)
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
  const { playerId, name, position, nflTeam, yearAcquired } = body;

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  const updates: Partial<{
    name: string;
    position: "QB" | "WR" | "RB" | "TE";
    nflTeam: string | null;
    yearAcquired: number;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (name) updates.name = name;
  if (position) updates.position = position;
  if (nflTeam !== undefined) updates.nflTeam = nflTeam || null;
  if (yearAcquired) updates.yearAcquired = yearAcquired;

  await db.update(players).set(updates).where(eq(players.id, playerId));

  return NextResponse.json({ success: true });
}

// PUT - Bulk import players (commissioner only)
export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Commissioner only" }, { status: 403 });
  }

  const body = await request.json();
  const { players: playerList } = body as {
    players: Array<{ name: string; yearAcquired: number }>;
  };

  if (!playerList || !Array.isArray(playerList) || playerList.length === 0) {
    return NextResponse.json({ error: "players array is required" }, { status: 400 });
  }

  // Get existing player names to avoid duplicates
  const existingPlayers = await db
    .select({ name: players.name })
    .from(players);
  const existingNames = new Set(existingPlayers.map((p) => p.name.toLowerCase()));

  // Filter out duplicates
  const newPlayers = playerList.filter(
    (p) => p.name && p.yearAcquired && !existingNames.has(p.name.toLowerCase())
  );

  if (newPlayers.length === 0) {
    return NextResponse.json({
      success: true,
      imported: 0,
      skipped: playerList.length,
      message: "All players already exist",
    });
  }

  // Bulk insert
  await db.insert(players).values(
    newPlayers.map((p) => ({
      name: p.name,
      yearAcquired: p.yearAcquired,
      position: null,
      nflTeam: null,
    }))
  );

  return NextResponse.json({
    success: true,
    imported: newPlayers.length,
    skipped: playerList.length - newPlayers.length,
  });
}

// DELETE - Deactivate a player from the master registry (commissioner only)
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
  const { playerId } = body;

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  // Soft delete - mark as inactive
  await db
    .update(players)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(players.id, playerId));

  return NextResponse.json({ success: true });
}
