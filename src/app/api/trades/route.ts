import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trades, tradeAssets, tradeParticipants } from "@/lib/db/schema";
import { getUser, isCommissioner } from "@/lib/auth/server";

// POST - Record a new trade (commissioner only)
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
  const { tradeDate, season, notes, assets } = body;

  if (!tradeDate || !season || !assets || assets.length === 0) {
    return NextResponse.json(
      { error: "tradeDate, season, and at least one asset are required" },
      { status: 400 }
    );
  }

  // Create the trade record
  const newTrade = await db
    .insert(trades)
    .values({
      tradeDate,
      season,
      notes: notes || null,
      recordedBy: user.id,
    })
    .returning({ id: trades.id });

  const tradeId = newTrade[0].id;

  // Determine unique participating teams
  const teamIds = new Set<number>();
  for (const asset of assets) {
    teamIds.add(asset.fromTeamId);
    teamIds.add(asset.toTeamId);
  }

  // Insert participants
  for (const teamId of teamIds) {
    await db.insert(tradeParticipants).values({
      tradeId,
      teamId,
    });
  }

  // Insert assets
  for (const asset of assets) {
    await db.insert(tradeAssets).values({
      tradeId,
      assetType: "player", // Default; could be 'draft_pick'
      fromTeamId: asset.fromTeamId,
      toTeamId: asset.toTeamId,
      description: asset.description,
    });
  }

  return NextResponse.json({ success: true, tradeId });
}
