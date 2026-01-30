import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trades, tradeAssets, tradeParticipants } from "@/lib/db/schema";
import { isCommissioner } from "@/lib/auth/server";
import { eq } from "drizzle-orm";

// DELETE - Remove a trade (commissioner only)
// Note: This only deletes the trade record, it does NOT reverse the asset transfers
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const tradeId = parseInt(id);

  if (isNaN(tradeId)) {
    return NextResponse.json({ error: "Invalid trade ID" }, { status: 400 });
  }

  try {
    // Check if trade exists
    const existingTrade = await db
      .select()
      .from(trades)
      .where(eq(trades.id, tradeId))
      .limit(1);

    if (existingTrade.length === 0) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    // Delete trade assets first (foreign key constraint)
    await db.delete(tradeAssets).where(eq(tradeAssets.tradeId, tradeId));

    // Delete trade participants
    await db.delete(tradeParticipants).where(eq(tradeParticipants.tradeId, tradeId));

    // Delete the trade itself
    await db.delete(trades).where(eq(trades.id, tradeId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting trade:", error);
    return NextResponse.json(
      { error: "Failed to delete trade" },
      { status: 500 }
    );
  }
}
