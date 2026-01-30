import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trades, tradeAssets, tradeParticipants, teams } from "@/lib/db/schema";
import { isCommissioner, getUser } from "@/lib/auth/server";
import { eq } from "drizzle-orm";

interface ParsedTradeRow {
  date: string;
  teamName: string;
  sent: string[];
  received: string[];
  season: number;
}

interface ParsedTrade {
  date: string;
  season: number;
  team1: { name: string; sent: string[]; received: string[] };
  team2: { name: string; sent: string[]; received: string[] };
}

function parseAssetList(assetString: string): string[] {
  // Remove quotes and split by newlines
  const cleaned = assetString.replace(/^"|"$/g, "").trim();
  // Split by newlines and clean up numbered prefixes
  return cleaned
    .split("\n")
    .map((item) => item.replace(/^\d+\.\s*/, "").trim())
    .filter((item) => item.length > 0);
}

function parseImportData(data: string): ParsedTrade[] {
  const lines = data.trim().split("\n");
  const trades: ParsedTrade[] = [];

  let currentTrade: Partial<ParsedTrade> | null = null;
  let currentDate = "";
  let currentSeason = 0;

  for (const line of lines) {
    if (!line.trim()) continue;

    // Split by tabs, but handle quoted fields that may contain tabs
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === "\t" && !inQuotes) {
        parts.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    parts.push(current);

    // Parse the row
    const [date, teamName, sent, received, season] = parts;

    // If we have a date, this is the first row of a new trade
    if (date && date.trim()) {
      // Save previous trade if exists
      if (currentTrade && currentTrade.team1 && currentTrade.team2) {
        trades.push(currentTrade as ParsedTrade);
      }

      currentDate = date.trim();
      currentSeason = parseInt(season?.trim() || "2025");

      currentTrade = {
        date: currentDate,
        season: currentSeason,
        team1: {
          name: teamName?.trim() || "",
          sent: parseAssetList(sent || ""),
          received: parseAssetList(received || ""),
        },
      };
    } else if (currentTrade && teamName?.trim()) {
      // This is the second row of the trade
      const rowSeason = season?.trim() ? parseInt(season.trim()) : currentSeason;

      currentTrade.team2 = {
        name: teamName.trim(),
        sent: parseAssetList(sent || ""),
        received: parseAssetList(received || ""),
      };

      // Use the season from either row
      if (rowSeason && !isNaN(rowSeason)) {
        currentTrade.season = rowSeason;
      }
    }
  }

  // Don't forget the last trade
  if (currentTrade && currentTrade.team1 && currentTrade.team2) {
    trades.push(currentTrade as ParsedTrade);
  }

  return trades;
}

function parseDate(dateStr: string): string {
  // Handle MM/DD/YYYY format
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const [month, day, year] = parts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  // Return as-is if already in correct format
  return dateStr;
}

// POST - Import historical trades
export async function POST(request: Request) {
  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { data } = body;

    if (!data || typeof data !== "string") {
      return NextResponse.json(
        { error: "No data provided" },
        { status: 400 }
      );
    }

    // Get all teams for lookup
    const allTeams = await db.select().from(teams);
    const teamByName = new Map(allTeams.map((t) => [t.name.toLowerCase(), t]));
    const teamByAbbr = new Map(allTeams.map((t) => [t.abbreviation.toLowerCase(), t]));

    const findTeam = (name: string) => {
      const lower = name.toLowerCase();
      return teamByName.get(lower) || teamByAbbr.get(lower);
    };

    // Parse the import data
    const parsedTrades = parseImportData(data);

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const trade of parsedTrades) {
      const team1 = findTeam(trade.team1.name);
      const team2 = findTeam(trade.team2.name);

      if (!team1) {
        errors.push(`Team not found: ${trade.team1.name}`);
        skipped++;
        continue;
      }
      if (!team2) {
        errors.push(`Team not found: ${trade.team2.name}`);
        skipped++;
        continue;
      }

      try {
        // Create the trade record
        const tradeDate = parseDate(trade.date);
        const [newTrade] = await db
          .insert(trades)
          .values({
            tradeDate,
            season: trade.season,
            notes: "Imported from historical data",
            recordedBy: user.id,
          })
          .returning({ id: trades.id });

        const tradeId = newTrade.id;

        // Insert participants
        await db.insert(tradeParticipants).values([
          { tradeId, teamId: team1.id },
          { tradeId, teamId: team2.id },
        ]);

        // Insert assets - what team1 sent goes to team2
        for (const asset of trade.team1.sent) {
          await db.insert(tradeAssets).values({
            tradeId,
            assetType: asset.toLowerCase().includes("round pick") ? "draft_pick" : "player",
            fromTeamId: team1.id,
            toTeamId: team2.id,
            description: asset,
          });
        }

        // Insert assets - what team2 sent goes to team1
        for (const asset of trade.team2.sent) {
          await db.insert(tradeAssets).values({
            tradeId,
            assetType: asset.toLowerCase().includes("round pick") ? "draft_pick" : "player",
            fromTeamId: team2.id,
            toTeamId: team1.id,
            description: asset,
          });
        }

        imported++;
      } catch (err) {
        console.error("Error importing trade:", err);
        errors.push(`Failed to import trade on ${trade.date}: ${err}`);
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: errors.slice(0, 10), // Only return first 10 errors
    });
  } catch (error) {
    console.error("Error importing trades:", error);
    return NextResponse.json(
      { error: "Failed to import trades" },
      { status: 500 }
    );
  }
}
