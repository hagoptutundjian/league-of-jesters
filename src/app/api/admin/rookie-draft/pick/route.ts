import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rookieDraftHistory } from "@/lib/db/schema";
import { isCommissioner } from "@/lib/auth/server";
import { eq, and } from "drizzle-orm";

// POST - Add a single draft pick
export async function POST(request: Request) {
  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { year, round, pick, teamId, playerName } = body;

    if (!year || !round || !pick || !teamId || !playerName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Format the overall pick (e.g., "1.01", "2.05")
    const overallPick = `${round}.${pick.toString().padStart(2, "0")}`;

    // Check for duplicate
    const existing = await db
      .select()
      .from(rookieDraftHistory)
      .where(
        and(
          eq(rookieDraftHistory.year, year),
          eq(rookieDraftHistory.round, round),
          eq(rookieDraftHistory.pick, pick)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Pick ${overallPick} in ${year} already exists` },
        { status: 409 }
      );
    }

    const [newPick] = await db
      .insert(rookieDraftHistory)
      .values({
        year,
        round,
        pick,
        overallPick,
        teamId,
        playerName,
      })
      .returning();

    return NextResponse.json({ success: true, pick: newPick });
  } catch (error) {
    console.error("Error adding draft pick:", error);
    return NextResponse.json(
      { error: "Failed to add draft pick" },
      { status: 500 }
    );
  }
}

// PUT - Update an existing draft pick
export async function PUT(request: Request) {
  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, year, round, pick, teamId, playerName } = body;

    if (!id) {
      return NextResponse.json({ error: "Pick ID is required" }, { status: 400 });
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};
    if (year !== undefined) updates.year = year;
    if (round !== undefined) updates.round = round;
    if (pick !== undefined) updates.pick = pick;
    if (teamId !== undefined) updates.teamId = teamId;
    if (playerName !== undefined) updates.playerName = playerName;

    // If round or pick changed, update overallPick
    if (round !== undefined || pick !== undefined) {
      // Get current values if not provided
      const current = await db
        .select()
        .from(rookieDraftHistory)
        .where(eq(rookieDraftHistory.id, id))
        .limit(1);

      if (current.length === 0) {
        return NextResponse.json({ error: "Pick not found" }, { status: 404 });
      }

      const newRound = round !== undefined ? round : current[0].round;
      const newPick = pick !== undefined ? pick : current[0].pick;
      updates.overallPick = `${newRound}.${newPick.toString().padStart(2, "0")}`;
    }

    const [updated] = await db
      .update(rookieDraftHistory)
      .set(updates)
      .where(eq(rookieDraftHistory.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Pick not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, pick: updated });
  } catch (error) {
    console.error("Error updating draft pick:", error);
    return NextResponse.json(
      { error: "Failed to update draft pick" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a draft pick
export async function DELETE(request: Request) {
  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Pick ID is required" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(rookieDraftHistory)
      .where(eq(rookieDraftHistory.id, parseInt(id)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Pick not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting draft pick:", error);
    return NextResponse.json(
      { error: "Failed to delete draft pick" },
      { status: 500 }
    );
  }
}
