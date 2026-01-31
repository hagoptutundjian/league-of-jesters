import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contracts, transactions, players } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser, isCommissioner } from "@/lib/auth/server";
import { ACQUISITION_TYPES } from "@/lib/constants";

// PATCH - Update contract details (commissioner only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const contractId = parseInt(id);

  if (isNaN(contractId)) {
    return NextResponse.json(
      { error: "Invalid contract ID" },
      { status: 400 }
    );
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json(
      { error: "Only commissioners can edit acquisition types" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { acquisitionType } = body;

  if (!acquisitionType) {
    return NextResponse.json(
      { error: "acquisitionType is required" },
      { status: 400 }
    );
  }

  if (!ACQUISITION_TYPES.includes(acquisitionType)) {
    return NextResponse.json(
      { error: "Invalid acquisition type" },
      { status: 400 }
    );
  }

  // Get the current contract
  const contract = await db
    .select({
      id: contracts.id,
      playerId: contracts.playerId,
      teamId: contracts.teamId,
      acquisitionType: contracts.acquisitionType,
    })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (contract.length === 0) {
    return NextResponse.json(
      { error: "Contract not found" },
      { status: 404 }
    );
  }

  const currentContract = contract[0];
  const oldType = currentContract.acquisitionType;

  // Update the acquisition type
  await db
    .update(contracts)
    .set({
      acquisitionType,
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, contractId));

  // Log the transaction
  await db.insert(transactions).values({
    teamId: currentContract.teamId,
    playerId: currentContract.playerId,
    contractId: contractId,
    action: "acquisition_type_change",
    details: {
      from: oldType,
      to: acquisitionType,
    },
    performedBy: user.id,
  });

  return NextResponse.json({ success: true });
}
