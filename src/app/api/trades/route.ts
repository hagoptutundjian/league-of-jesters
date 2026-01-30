import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  trades,
  tradeAssets,
  tradeParticipants,
  contracts,
  draftPicks,
  transactions,
} from "@/lib/db/schema";
import { getUser, isCommissioner } from "@/lib/auth/server";
import { eq } from "drizzle-orm";

interface TradeAssetInput {
  assetType: "player" | "draft_pick";
  playerId?: number;
  contractId?: number;
  draftPickId?: number;
  fromTeamId: number;
  toTeamId: number;
  description: string;
}

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
  const {
    tradeDate,
    season,
    notes,
    assets,
    executeTransfer = false,
  }: {
    tradeDate: string;
    season: number;
    notes?: string;
    assets: TradeAssetInput[];
    executeTransfer?: boolean;
  } = body;

  if (!tradeDate || !season || !assets || assets.length === 0) {
    return NextResponse.json(
      { error: "tradeDate, season, and at least one asset are required" },
      { status: 400 }
    );
  }

  try {
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

    // Insert assets and execute transfers
    for (const asset of assets) {
      // Insert the trade asset record
      await db.insert(tradeAssets).values({
        tradeId,
        assetType: asset.assetType,
        playerId: asset.playerId || null,
        contractId: asset.contractId || null,
        draftPickId: asset.draftPickId || null,
        fromTeamId: asset.fromTeamId,
        toTeamId: asset.toTeamId,
        description: asset.description,
      });

      // Execute the actual transfer if requested
      if (executeTransfer) {
        if (asset.assetType === "player" && asset.contractId) {
          // Transfer the player's contract to the new team
          await db
            .update(contracts)
            .set({
              teamId: asset.toTeamId,
              acquisitionType: "trade",
              updatedAt: new Date(),
            })
            .where(eq(contracts.id, asset.contractId));

          // Log the transaction for the sending team
          await db.insert(transactions).values({
            teamId: asset.fromTeamId,
            playerId: asset.playerId,
            contractId: asset.contractId,
            action: "trade_out",
            details: {
              tradeId,
              toTeamId: asset.toTeamId,
              description: asset.description,
            },
            performedBy: user.id,
          });

          // Log the transaction for the receiving team
          await db.insert(transactions).values({
            teamId: asset.toTeamId,
            playerId: asset.playerId,
            contractId: asset.contractId,
            action: "trade_in",
            details: {
              tradeId,
              fromTeamId: asset.fromTeamId,
              description: asset.description,
            },
            performedBy: user.id,
          });
        } else if (asset.assetType === "draft_pick" && asset.draftPickId) {
          // Transfer the draft pick to the new team
          await db
            .update(draftPicks)
            .set({
              currentTeamId: asset.toTeamId,
              updatedAt: new Date(),
            })
            .where(eq(draftPicks.id, asset.draftPickId));

          // Log the transaction for the sending team
          await db.insert(transactions).values({
            teamId: asset.fromTeamId,
            action: "trade_pick_out",
            details: {
              tradeId,
              draftPickId: asset.draftPickId,
              toTeamId: asset.toTeamId,
              description: asset.description,
            },
            performedBy: user.id,
          });

          // Log the transaction for the receiving team
          await db.insert(transactions).values({
            teamId: asset.toTeamId,
            action: "trade_pick_in",
            details: {
              tradeId,
              draftPickId: asset.draftPickId,
              fromTeamId: asset.fromTeamId,
              description: asset.description,
            },
            performedBy: user.id,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      tradeId,
      assetsTransferred: executeTransfer ? assets.length : 0,
    });
  } catch (error) {
    console.error("Error recording trade:", error);
    return NextResponse.json(
      { error: "Failed to record trade" },
      { status: 500 }
    );
  }
}
