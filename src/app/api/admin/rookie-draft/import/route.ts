import { NextRequest, NextResponse } from "next/server";
import { isCommissioner } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { rookieDraftHistory, teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data } = await request.json();

    if (!data || typeof data !== "string") {
      return NextResponse.json(
        { error: "Invalid data format" },
        { status: 400 }
      );
    }

    // Get all teams for lookup
    const allTeams = await db.select().from(teams);
    const teamMap = new Map<string, number>();
    allTeams.forEach((team) => {
      teamMap.set(team.abbreviation.toLowerCase(), team.id);
      teamMap.set(team.name.toLowerCase(), team.id);
    });

    // Parse the data
    const lines = data.trim().split("\n");
    const picks: {
      year: number;
      round: number;
      pick: number;
      overallPick: string;
      teamId: number;
      playerName: string;
    }[] = [];
    let skipped = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Split by tab
      const parts = line.split("\t");
      if (parts.length < 4) {
        // Try splitting by multiple spaces
        const spaceParts = line.split(/\s{2,}/);
        if (spaceParts.length >= 4) {
          parts.length = 0;
          parts.push(...spaceParts);
        }
      }

      // Skip header row
      if (
        parts[0]?.toLowerCase() === "year" ||
        parts[1]?.toLowerCase() === "pick"
      ) {
        continue;
      }

      // Parse fields
      const year = parseInt(parts[0]);
      const pickStr = parts[1]?.trim();
      const teamAbbr = parts[2]?.trim();
      const playerName = parts[3]?.trim();

      // Validate
      if (!year || isNaN(year) || !pickStr || !teamAbbr || !playerName) {
        skipped++;
        continue;
      }

      // Parse pick (e.g., "1.01" -> round 1, pick 1)
      const pickParts = pickStr.split(".");
      if (pickParts.length !== 2) {
        skipped++;
        continue;
      }

      const round = parseInt(pickParts[0]);
      const pick = parseInt(pickParts[1]);

      if (isNaN(round) || isNaN(pick)) {
        skipped++;
        continue;
      }

      // Look up team
      const teamId = teamMap.get(teamAbbr.toLowerCase());
      if (!teamId) {
        console.warn(`Unknown team: ${teamAbbr}`);
        skipped++;
        continue;
      }

      picks.push({
        year,
        round,
        pick,
        overallPick: pickStr,
        teamId,
        playerName,
      });
    }

    // Insert picks (skip duplicates)
    let imported = 0;
    for (const pick of picks) {
      try {
        await db.insert(rookieDraftHistory).values(pick);
        imported++;
      } catch (err: any) {
        // Skip duplicate key violations
        if (err?.code === "23505") {
          skipped++;
        } else {
          console.error("Error inserting pick:", err);
          skipped++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: picks.length,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to import draft data" },
      { status: 500 }
    );
  }
}
