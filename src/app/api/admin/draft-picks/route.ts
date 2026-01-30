import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { draftPicks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser, isCommissioner } from "@/lib/auth/server";

// POST - Add a new draft pick
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
  const { year, round, originalTeamId, currentTeamId } = body;

  if (!year || !round || !originalTeamId) {
    return NextResponse.json(
      { error: "year, round, and originalTeamId are required" },
      { status: 400 }
    );
  }

  const newPick = await db
    .insert(draftPicks)
    .values({
      year,
      round,
      originalTeamId,
      currentTeamId: currentTeamId || originalTeamId,
    })
    .returning({ id: draftPicks.id });

  return NextResponse.json({ success: true, pickId: newPick[0].id });
}

// PATCH - Update draft pick ownership
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
  const { pickId, currentTeamId } = body;

  if (!pickId || !currentTeamId) {
    return NextResponse.json(
      { error: "pickId and currentTeamId are required" },
      { status: 400 }
    );
  }

  await db
    .update(draftPicks)
    .set({ currentTeamId, updatedAt: new Date() })
    .where(eq(draftPicks.id, pickId));

  return NextResponse.json({ success: true });
}

// DELETE - Remove a draft pick
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
  const { pickId } = body;

  if (!pickId) {
    return NextResponse.json({ error: "pickId is required" }, { status: 400 });
  }

  await db.delete(draftPicks).where(eq(draftPicks.id, pickId));

  return NextResponse.json({ success: true });
}
