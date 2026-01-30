import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  teams,
  contracts,
  players,
  droppedPlayerHistory,
  transactions,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUser } from "@/lib/auth/server";
import { calculateSalary, calculateCapHit } from "@/lib/salary/engine";
import { CAP_BY_YEAR } from "@/lib/constants";

async function getTeamAndAuth(slug: string) {
  const user = await getUser();
  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }

  const team = await db
    .select()
    .from(teams)
    .where(eq(teams.slug, slug))
    .limit(1);

  if (team.length === 0) {
    return { error: "Team not found", status: 404 };
  }

  const currentTeam = team[0];
  const isOwner = user.id === currentTeam.userId;
  const isCommissioner = user.user_metadata?.role === "commissioner";

  if (!isOwner && !isCommissioner) {
    return { error: "Forbidden", status: 403 };
  }

  return { user, team: currentTeam };
}

// PATCH - Change player roster status (active/PS/IR)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const auth = await getTeamAndAuth(slug);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const body = await request.json();
  const { contractId, newStatus } = body;

  if (!contractId || !newStatus) {
    return NextResponse.json(
      { error: "contractId and newStatus are required" },
      { status: 400 }
    );
  }

  if (!["active", "practice_squad", "injured_reserve"].includes(newStatus)) {
    return NextResponse.json(
      { error: "Invalid status" },
      { status: 400 }
    );
  }

  // Get the contract
  const contract = await db
    .select()
    .from(contracts)
    .where(
      and(
        eq(contracts.id, contractId),
        eq(contracts.teamId, auth.team.id),
        eq(contracts.isActive, true)
      )
    )
    .limit(1);

  if (contract.length === 0) {
    return NextResponse.json(
      { error: "Contract not found" },
      { status: 404 }
    );
  }

  const currentContract = contract[0];

  // Update the status
  await db
    .update(contracts)
    .set({
      rosterStatus: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, contractId));

  // Log transaction
  await db.insert(transactions).values({
    teamId: auth.team.id,
    playerId: currentContract.playerId,
    contractId: contractId,
    action: `status_change_${newStatus}`,
    details: {
      from: currentContract.rosterStatus,
      to: newStatus,
    },
    performedBy: auth.user.id,
  });

  return NextResponse.json({ success: true });
}

// DELETE - Drop a player
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const auth = await getTeamAndAuth(slug);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const body = await request.json();
  const { contractId } = body;

  if (!contractId) {
    return NextResponse.json(
      { error: "contractId is required" },
      { status: 400 }
    );
  }

  // Get the contract with player info
  const contract = await db
    .select({
      id: contracts.id,
      playerId: contracts.playerId,
      salary2025: contracts.salary2025,
      yearAcquired: contracts.yearAcquired,
      acquisitionType: contracts.acquisitionType,
      rosterStatus: contracts.rosterStatus,
    })
    .from(contracts)
    .where(
      and(
        eq(contracts.id, contractId),
        eq(contracts.teamId, auth.team.id),
        eq(contracts.isActive, true)
      )
    )
    .limit(1);

  if (contract.length === 0) {
    return NextResponse.json(
      { error: "Contract not found" },
      { status: 404 }
    );
  }

  const currentContract = contract[0];
  const currentYear = 2025;
  const salaryAtDrop = calculateSalary(
    Number(currentContract.salary2025),
    currentContract.yearAcquired,
    currentYear
  );

  // Deactivate the contract
  await db
    .update(contracts)
    .set({
      isActive: false,
      droppedAt: new Date(),
      droppedByTeamId: auth.team.id,
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, contractId));

  // Record in dropped player history for reacquisition rule
  const originalSalary = Number(currentContract.salary2025);
  await db.insert(droppedPlayerHistory).values({
    playerId: currentContract.playerId,
    droppedByTeamId: auth.team.id,
    salaryAtDrop: salaryAtDrop.toString(),
    yearDropped: currentYear,
    yearAcquired: currentContract.yearAcquired,
    acquisitionType: currentContract.acquisitionType,
    canReacquireCheaper: originalSalary <= 5,
  });

  // Log transaction
  await db.insert(transactions).values({
    teamId: auth.team.id,
    playerId: currentContract.playerId,
    contractId: contractId,
    action: "drop",
    details: {
      salaryAtDrop,
      yearAcquired: currentContract.yearAcquired,
    },
    performedBy: auth.user.id,
  });

  return NextResponse.json({ success: true });
}

// POST - Add a player to the roster
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const auth = await getTeamAndAuth(slug);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const body = await request.json();
  const {
    playerId: providedPlayerId,
    playerName,
    position,
    salary,
    yearAcquired: providedYearAcquired,
    acquisitionType = "free_agent",
    rosterStatus = "active",
    salaryYear, // The year the salary was entered for
  } = body;

  // If playerId is provided, use it (from master registry)
  // Otherwise fall back to playerName lookup for backward compatibility
  let playerId: number;
  let yearAcquired: number;

  if (providedPlayerId) {
    // Player selected from master registry
    const masterPlayer = await db
      .select()
      .from(players)
      .where(eq(players.id, providedPlayerId))
      .limit(1);

    if (masterPlayer.length === 0) {
      return NextResponse.json(
        { error: "Player not found in master registry" },
        { status: 400 }
      );
    }

    playerId = masterPlayer[0].id;
    yearAcquired = masterPlayer[0].yearAcquired; // Use year from master registry

    // Check if player already has an active contract
    const activeContract = await db
      .select()
      .from(contracts)
      .where(
        and(
          eq(contracts.playerId, playerId),
          eq(contracts.isActive, true)
        )
      )
      .limit(1);

    if (activeContract.length > 0) {
      return NextResponse.json(
        { error: "Player already has an active contract with another team" },
        { status: 400 }
      );
    }

    // Update the player's position if provided (from position group)
    if (position && position !== masterPlayer[0].position) {
      await db
        .update(players)
        .set({ position: position as "QB" | "WR" | "RB" | "TE" })
        .where(eq(players.id, playerId));
    }
  } else {
    // Legacy flow: lookup or create by name
    if (!playerName || !position || salary === undefined || !providedYearAcquired) {
      return NextResponse.json(
        { error: "playerName, position, salary, and yearAcquired are required" },
        { status: 400 }
      );
    }

    yearAcquired = providedYearAcquired;

    const existingPlayer = await db
      .select()
      .from(players)
      .where(eq(players.name, playerName))
      .limit(1);

    if (existingPlayer.length > 0) {
      playerId = existingPlayer[0].id;

      // Check if player already has an active contract
      const activeContract = await db
        .select()
        .from(contracts)
        .where(
          and(
            eq(contracts.playerId, playerId),
            eq(contracts.isActive, true)
          )
        )
        .limit(1);

      if (activeContract.length > 0) {
        return NextResponse.json(
          { error: "Player already has an active contract with another team" },
          { status: 400 }
        );
      }
    } else {
      // Create new player with provided year acquired
      const newPlayer = await db
        .insert(players)
        .values({
          name: playerName,
          position,
          yearAcquired,
        })
        .returning({ id: players.id });
      playerId = newPlayer[0].id;
    }
  }

  if (salary === undefined) {
    return NextResponse.json(
      { error: "salary is required" },
      { status: 400 }
    );
  }

  // Create the contract
  // salaryYear is the year the salary was entered for (defaults to 2025 if not provided)
  const newContract = await db
    .insert(contracts)
    .values({
      playerId,
      teamId: auth.team.id,
      salary2025: salary.toString(),
      salaryYear: salaryYear || 2025,
      yearAcquired,
      acquisitionType,
      rosterStatus,
      originalSalary2025: salary.toString(),
    })
    .returning({ id: contracts.id });

  // Log transaction
  await db.insert(transactions).values({
    teamId: auth.team.id,
    playerId,
    contractId: newContract[0].id,
    action: "add",
    details: {
      salary,
      yearAcquired,
      acquisitionType,
      rosterStatus,
    },
    performedBy: auth.user.id,
  });

  return NextResponse.json({ success: true, contractId: newContract[0].id });
}
